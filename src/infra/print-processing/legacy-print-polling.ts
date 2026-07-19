import { logger } from '../../lib/logger.js'
import { printProcessingConfig } from '../../shared/config/redis.js'
import { ProcessPrintJobsService } from '../../modules/print-jobs/services/process-print-jobs-service.js'

let interval: NodeJS.Timeout | null = null
let running = false
let executionInFlight: Promise<void> | null = null

async function runPollingTick() {
  if (running) {
    return
  }

  running = true

  executionInFlight = (async () => {
    try {
      await new ProcessPrintJobsService().execute(`legacy:${process.pid}`)
    } catch (error) {
      logger.error(error, 'Legacy print polling error')
    } finally {
      running = false
      executionInFlight = null
    }
  })()

  await executionInFlight
}

export function startLegacyPrintPolling() {
  if (interval) {
    return
  }

  interval = setInterval(() => {
    void runPollingTick()
  }, printProcessingConfig.pollingIntervalMs)

  interval.unref?.()

  logger.info(
    {
      intervalMs: printProcessingConfig.pollingIntervalMs
    },
    'Legacy print polling started'
  )
}

export async function stopLegacyPrintPolling() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }

  if (executionInFlight) {
    await executionInFlight
  }

  logger.info('Legacy print polling stopped')
}

export function getLegacyPrintPollingStatus() {
  return {
    running: Boolean(interval),
    executionInFlight: running
  }
}
