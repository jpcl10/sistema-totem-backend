import { prisma } from '../../../lib/prisma.js'

interface UploadEventLogoServiceRequest {
  organizationId: string
  eventId: string
  logoUrl: string
}

export class UploadEventLogoService {
  async execute({
    organizationId,
    eventId,
    logoUrl
  }: UploadEventLogoServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const updatedEvent = await prisma.event.update({
      where: {
        id: eventId
      },
      data: {
        logoUrl
      }
    })

    return {
      event: updatedEvent
    }
  }
}