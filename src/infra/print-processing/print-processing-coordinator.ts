import { logger } from '../../lib/logger.js'
import { closeRedisConnections, pingRedis } from '../redis/redis-client.js'
import {
  closePrintingQueue,
  getPrintingQueueHealth,
  getPrintingWorkerStatus,
  reconcilePendingPrintJobs,
  startPrintingWorker,
  stopPrintingWorker
} from '../queues/index.js'
import {
  printProcessingConfig,
  redisConfig
} from '../../shared/config/redis.js'
import {
  getLegacyPrintPollingStatus,
  startLegacyPrintPolling,
  stopLegacyPrintPolling
} from './legacy-print-polling.js'

export type PrintProcessingMode =
  | 'BULLMQ'
  | 'LEGACY_POLLING'
  | 'DISABLED'

type CoordinatorState = {
  configuredMode: PrintProcessingMode
  activeMode: PrintProcessingMode
  redisHealthy: boolean
  degradedReason: string | null
  lastModeTransitionAt: string | null
}

let transitionLock: Promise<void> = Promise.resolve()
let monitor: NodeJS.Timeout | null = null
let pendingRedisFailureCheck: NodeJS.Timeout | null = null

const state: CoordinatorState = {
  configuredMode: printProcessingConfig.configuredMode,
  activeMode: 'DISABLED',
  redisHealthy: false,
  degradedReason: null,
  lastModeTransitionAt: null
}

function withTransitionLock(action: () => Promise<void>) {
  transitionLock = transitionLock.then(action, action)
  return transitionLock
}

function setMode(mode: PrintProcessingMode, degradedReason: string | null) {
  if (state.activeMode !== mode || state.degradedReason !== degradedReason) {
    state.activeMode = mode
    state.degradedReason = degradedReason
    state.lastModeTransitionAt = new Date().toISOString()
  }
}

async function activateBullMq() {
  await stopLegacyPrintPolling()
  await startPrintingWorker()
  await reconcilePendingPrintJobs()
  setMode('BULLMQ', null)
}

async function activateLegacyPolling(reason: string) {
  await stopPrintingWorker()
  await closePrintingQueue()
  await closeRedisConnections()
  startLegacyPrintPolling()
  setMode('LEGACY_POLLING', reason)
}

async function activateDisabled(reason: string | null) {
  await stopLegacyPrintPolling()
  await stopPrintingWorker()
  await closePrintingQueue()
  setMode('DISABLED', reason)
}

async function evaluateMode() {
  await withTransitionLock(async () => {
    if (state.configuredMode === 'DISABLED') {
      await activateDisabled(null)
      return
    }

    if (!redisConfig.enabled || state.configuredMode === 'LEGACY_POLLING') {
      state.redisHealthy = false
      await activateLegacyPolling(
        redisConfig.enabled
          ? 'configured_legacy_polling'
          : 'redis_disabled'
      )
      return
    }

    const redisHealth = await pingRedis()
    const queueHealth = await getPrintingQueueHealth()
    const healthy =
      redisHealth.status === 'ok' && queueHealth.status !== 'unavailable'

    state.redisHealthy = healthy

    if (healthy) {
      if (pendingRedisFailureCheck) {
        clearTimeout(pendingRedisFailureCheck)
        pendingRedisFailureCheck = null
      }

      await activateBullMq()
      return
    }

    if (state.activeMode !== 'BULLMQ') {
      setMode(state.activeMode, 'redis_unavailable')
      return
    }

    if (pendingRedisFailureCheck) {
      return
    }

    state.degradedReason = 'redis_unavailable_waiting_grace_period'
    pendingRedisFailureCheck = setTimeout(() => {
      pendingRedisFailureCheck = null
      void confirmRedisFailureAfterGrace()
    }, printProcessingConfig.redisFailureGraceMs)
    pendingRedisFailureCheck.unref?.()

    logger.warn(
      {
        graceMs: printProcessingConfig.redisFailureGraceMs
      },
      'Redis unavailable; waiting grace period before legacy print fallback'
    )
  })
}

async function confirmRedisFailureAfterGrace() {
  await withTransitionLock(async () => {
    const redisHealth = await pingRedis()
    const queueHealth = await getPrintingQueueHealth()
    const healthy =
      redisHealth.status === 'ok' && queueHealth.status !== 'unavailable'

    state.redisHealthy = healthy

    if (healthy) {
      await activateBullMq()
      return
    }

    await activateLegacyPolling('redis_unavailable_after_grace_period')
  })
}

export async function startPrintProcessingCoordinator() {
  await evaluateMode()

  if (!monitor) {
    monitor = setInterval(() => {
      void evaluateMode()
    }, 10_000)
    monitor.unref?.()
  }
}

export async function stopPrintProcessingCoordinator() {
  if (monitor) {
    clearInterval(monitor)
    monitor = null
  }

  if (pendingRedisFailureCheck) {
    clearTimeout(pendingRedisFailureCheck)
    pendingRedisFailureCheck = null
  }

  await withTransitionLock(async () => {
    await activateDisabled('shutdown')
    await closeRedisConnections()
  })
}

export function getPrintProcessingStatus() {
  return {
    configuredMode: state.configuredMode,
    activeMode: state.activeMode,
    redisHealthy: state.redisHealthy,
    bullWorkerRunning: getPrintingWorkerStatus().running,
    legacyPollingRunning: getLegacyPrintPollingStatus().running,
    lastModeTransitionAt: state.lastModeTransitionAt,
    degradedReason: state.degradedReason
  }
}
