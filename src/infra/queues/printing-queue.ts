import { Queue } from 'bullmq'

import { createRedisConnection } from '../redis/redis-client.js'
import { logger } from '../../lib/logger.js'
import { redisConfig } from '../../shared/config/redis.js'

export const PRINTING_QUEUE_NAME = 'defumar:printing'
export const PROCESS_PRINT_JOB = 'PROCESS_PRINT_JOB'

export type PrintJobPayload = {
  printJobId: string
}

let printingQueue: Queue<PrintJobPayload> | null = null

export function getPrintingQueue() {
  if (!redisConfig.enabled) {
    return null
  }

  if (printingQueue) {
    return printingQueue
  }

  const connection = createRedisConnection('bullmq-producer')

  if (!connection) {
    return null
  }

  printingQueue = new Queue<PrintJobPayload>(PRINTING_QUEUE_NAME, {
    connection,
    prefix: redisConfig.keyPrefix,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2_000
      },
      removeOnComplete: {
        age: 60 * 60,
        count: 500
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 2_000
      }
    }
  })

  return printingQueue
}

export async function enqueuePrintJob(printJobId: string) {
  if (!redisConfig.enabled) {
    return {
      enqueued: false,
      reason: 'redis_disabled' as const
    }
  }

  const queue = getPrintingQueue()

  if (!queue) {
    return {
      enqueued: false,
      reason: 'queue_unavailable' as const
    }
  }

  const job = await queue.add(
    PROCESS_PRINT_JOB,
    { printJobId },
    {
      jobId: printJobId,
      delay: 0
    }
  )

  logger.info(
    {
      queueName: PRINTING_QUEUE_NAME,
      jobId: job.id,
      printJobId
    },
    'Print job enqueued'
  )

  return {
    enqueued: true,
    job
  }
}

export async function getPrintingQueueHealth() {
  if (!redisConfig.enabled) {
    return {
      enabled: false,
      status: 'disabled' as const
    }
  }

  try {
    const queue = getPrintingQueue()

    if (!queue) {
      return {
        enabled: true,
        status: 'unavailable' as const
      }
    }

    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed'
    )

    return {
      enabled: true,
      status: 'ok' as const,
      counts
    }
  } catch {
    return {
      enabled: true,
      status: 'unavailable' as const
    }
  }
}

export async function closePrintingQueue() {
  if (!printingQueue) {
    return
  }

  await printingQueue.close()
  printingQueue = null
}
