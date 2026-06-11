import { prisma } from '../../../lib/prisma.js'

interface ListPrintJobsServiceRequest {
  organizationId: string
  eventId: string
}

export class ListPrintJobsService {
  async execute({
    organizationId,
    eventId
  }: ListPrintJobsServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const printJobs =
      await prisma.eventPrintJob.findMany({
        where: {
          eventId
        },
        include: {
          printer: true,

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
          },

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
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

    return {
      printJobs
    }
  }
}