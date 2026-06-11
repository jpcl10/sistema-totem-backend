import { prisma } from '../../../lib/prisma.js'

interface GetEventServiceRequest {
  eventId: string
  organizationId: string
}

export class GetEventService {
  async execute({ eventId, organizationId }: GetEventServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    return {
      event
    }
  }
}