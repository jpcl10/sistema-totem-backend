import { prisma } from '../../../lib/prisma.js'

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
          event: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })

    return {
      printJobs
    }
  }
}