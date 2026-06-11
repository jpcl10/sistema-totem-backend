import { prisma } from '../../../../lib/prisma.js'

interface ListEventProductsServiceRequest {
  organizationId: string
  eventId: string
}

export class ListEventProductsService {
  async execute({
    organizationId,
    eventId
  }: ListEventProductsServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const eventProducts = await prisma.eventProduct.findMany({
      where: {
        eventId
      },
      include: {
        catalogProduct: {
          include: {
            catalogCategory: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      eventProducts
    }
  }
}