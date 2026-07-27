import { prisma } from '../../../lib/prisma.js'
import { logger } from '../../../lib/logger.js'
import { PrintTemplateService } from '../../print-templates/print-template-service.js'

const templateTypes = new Set([
  'PRODUCTION',
  'CUSTOMER',
  'DELIVERY',
  'CASHIER',
  'TEST'
])

interface ListDevicePendingPrintJobsServiceRequest {
  deviceId: string
}

const PROCESSING_LOCK_TTL_MS = 2 * 60 * 1000

function resolvePayloadTemplateType(payload: Record<string, unknown>) {
  const templateType = payload.templateType

  return typeof templateType === 'string' && templateTypes.has(templateType)
    ? templateType as 'PRODUCTION' | 'CUSTOMER' | 'DELIVERY' | 'CASHIER' | 'TEST'
    : 'PRODUCTION'
}

export class ListDevicePendingPrintJobsService {
  async execute({
    deviceId
  }: ListDevicePendingPrintJobsServiceRequest) {
    const staleLockBefore = new Date(Date.now() - PROCESSING_LOCK_TTL_MS)
    const printJobs =
      await prisma.$transaction(async tx => {
        const candidates = await tx.eventPrintJob.findMany({
          where: {
            deviceId,
            OR: [
              { status: 'PENDING' },
              {
                status: 'PROCESSING',
                lockedBy: deviceId,
                lockedAt: {
                  lt: staleLockBefore
                }
              }
            ]
          },
          orderBy: {
            createdAt: 'asc'
          },
          take: 10,
          select: {
            id: true
          }
        })

        if (candidates.length === 0) return []

        const candidateIds = candidates.map(job => job.id)

        await tx.eventPrintJob.updateMany({
          where: {
            id: {
              in: candidateIds
            },
            deviceId,
            OR: [
              { status: 'PENDING' },
              {
                status: 'PROCESSING',
                lockedBy: deviceId,
                lockedAt: {
                  lt: staleLockBefore
                }
              }
            ]
          },
          data: {
            status: 'PROCESSING',
            lockedAt: new Date(),
            lockedBy: deviceId,
            attempts: {
              increment: 1
            },
            lastAttemptAt: new Date()
          }
        })

        return tx.eventPrintJob.findMany({
          where: {
            id: {
              in: candidateIds
            },
            deviceId,
            status: 'PROCESSING',
            lockedBy: deviceId
          },
          orderBy: {
            createdAt: 'asc'
          },
          include: {
            order: {
              include: {
                items: true
              }
            },
            onlineOrder: {
              include: {
                items: true
              }
            },
            event: {
              select: {
                id: true,
                organizationId: true,
                name: true,
                slug: true
              }
            },
            store: {
              select: {
                id: true,
                organizationId: true,
                name: true,
                slug: true
              }
            },
            device: {
              select: {
                id: true,
                organizationId: true
              }
            }
          }
        })
      })

    logger.info({
      deviceId,
      jobsFound: printJobs.length,
      jobIds: printJobs.map(job => job.id),
      orderIds: printJobs.map(job => job.orderId).filter(Boolean),
      onlineOrderIds: printJobs.map(job => job.onlineOrderId).filter(Boolean),
      statuses: printJobs.map(job => job.status)
    }, '[PRINT_QUEUE] pending jobs claimed')

    const templateService = new PrintTemplateService()
    const enrichedPrintJobs = await Promise.all(
      printJobs.map(async (printJob) => {
        const payload =
          typeof printJob.payload === 'object' &&
          printJob.payload !== null &&
          !Array.isArray(printJob.payload)
            ? printJob.payload as Record<string, unknown>
            : {}
        const template = await templateService.resolve({
          organizationId:
            printJob.event?.organizationId ??
            printJob.store?.organizationId ??
            printJob.device?.organizationId,
          eventId: printJob.eventId ?? undefined,
          printerId: printJob.printerId ?? undefined,
          templateType: resolvePayloadTemplateType(payload)
        })

        return {
          ...printJob,
          payload: {
            ...payload,
            printTemplate: template
          }
        }
      })
    )

    return {
      printJobs: enrichedPrintJobs
    }
  }
}
