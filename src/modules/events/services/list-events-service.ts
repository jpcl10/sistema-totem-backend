import { prisma } from '../../../lib/prisma.js'

interface ListEventsServiceRequest {
  organizationId: string
}

export class ListEventsService {
  async execute({
    organizationId
  }: ListEventsServiceRequest) {
    const events = await prisma.event.findMany({
      where: {
        organizationId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      events
    }
  }
}