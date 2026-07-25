import { prisma } from '../../../lib/prisma.js'
import { PrintTemplateService } from '../../print-templates/print-template-service.js'

interface ListDevicePendingPrintJobsServiceRequest {
  deviceId: string
}

export class ListDevicePendingPrintJobsService {
  async execute({
    deviceId
  }: ListDevicePendingPrintJobsServiceRequest) {
    const printJobs =
      await prisma.eventPrintJob.findMany({
        where: {
          deviceId,
          status: 'PENDING'
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
          templateType: 'PRODUCTION'
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
