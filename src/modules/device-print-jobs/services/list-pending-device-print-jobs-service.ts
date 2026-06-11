import { prisma } from '../../../lib/prisma.js'

interface ListPendingDevicePrintJobsServiceRequest {
  organizationId: string
  eventId?: string
}

export class ListPendingDevicePrintJobsService {
  async execute({
    organizationId,
    eventId
  }: ListPendingDevicePrintJobsServiceRequest) {
    const printJobs =
      await prisma.eventPrintJob.findMany({
        where: {
          status: 'PENDING',

          event: {
            organizationId,
            printingEnabled: true
          },

          printer: {
            is: {
              active: true,
              connectionType: 'SK210_LOCAL'
            }
          },

          ...(eventId && {
            eventId
          })
        },

        include: {
          printer: true,

          event: {
            select: {
              id: true,
              name: true,
              slug: true,
              printingEnabled: true,
              autoPrintEnabled: true,
              printMode: true,
              printerPaperSize: true
            }
          },

          order: {
            include: {
              items: {
                include: {
                  catalogProduct: {
                    include: {
                      catalogCategory: true
                    }
                  }
                }
              }
            }
          }
        },

        orderBy: {
          createdAt: 'asc'
        },

        take: 10
      })

    return {
      printJobs
    }
  }
}