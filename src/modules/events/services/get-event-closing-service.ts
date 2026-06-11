import { prisma } from '../../../lib/prisma.js'

interface GetEventClosingServiceRequest {
  eventId: string
  organizationId: string
}

export class GetEventClosingService {
  async execute({
    eventId,
    organizationId
  }: GetEventClosingServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        closed: true,
        closedAt: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const closing = await prisma.eventClosing.findFirst({
      where: {
        eventId,
        organizationId
      },
      include: {
        closedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    if (!closing) {
      throw new Error('Event closing not found')
    }

    return {
      event,
      closing
    }
  }
}