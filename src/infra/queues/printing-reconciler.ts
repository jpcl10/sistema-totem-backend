import { PrintJobStatus } from '@prisma/client'

import { prisma } from '../../lib/prisma.js'
import { logger } from '../../lib/logger.js'
import { printProcessingConfig } from '../../shared/config/redis.js'
import { enqueuePrintJob, PRINTING_QUEUE_NAME } from './printing-queue.js'

export async function reconcilePendingPrintJobs() {
  const staleLockThreshold =
    new Date(Date.now() - printProcessingConfig.staleLockMs)

  const jobs = await prisma.eventPrintJob.findMany({
    where: {
      deviceId: null,
      OR: [
        {
          status: {
            in: [PrintJobStatus.PENDING, PrintJobStatus.RETRY]
          }
        },
        {
          status: PrintJobStatus.PROCESSING,
          lockedAt: {
            lt: staleLockThreshold
          }
        }
      ]
    },
    select: {
      id: true
    },
    orderBy: {
      createdAt: 'asc'
    },
    take: 500
  })

  let enqueuedCount = 0

  for (const job of jobs) {
    const result = await enqueuePrintJob(job.id)

    if (result.enqueued) {
      enqueuedCount += 1
    }
  }

  logger.info(
    {
      queueName: PRINTING_QUEUE_NAME,
      reconciledCount: jobs.length,
      enqueuedCount
    },
    'Print queue reconciled from PostgreSQL'
  )

  return {
    reconciledCount: jobs.length,
    enqueuedCount
  }
}
