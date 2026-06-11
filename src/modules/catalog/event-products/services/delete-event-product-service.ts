import { prisma } from '../../../../lib/prisma.js'

interface DeleteEventProductServiceRequest {
  organizationId: string

  eventId: string

  eventProductId: string
}

export class DeleteEventProductService {
  async execute({
    organizationId,
    eventId,
    eventProductId
  }: DeleteEventProductServiceRequest) {

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const eventProduct =
      await prisma.eventProduct.findFirst({
        where: {
          id: eventProductId,
          eventId
        }
      })

    if (!eventProduct) {
      throw new Error('Event product not found')
    }

    await prisma.eventProduct.delete({
      where: {
        id: eventProductId
      }
    })

    return {
      success: true
    }
  }
}