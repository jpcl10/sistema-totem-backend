import { prisma } from '../../../../lib/prisma.js'

interface CreateEventProductServiceRequest {
  organizationId: string

  eventId: string

  catalogProductId: string

  priceInCents: number
}

export class CreateEventProductService {
  async execute({
    organizationId,
    eventId,
    catalogProductId,
    priceInCents
  }: CreateEventProductServiceRequest) {

    const event =
      await prisma.event.findFirst({
        where: {
          id: eventId,
          organizationId
        }
      })

    if (!event) {
      throw new Error('Event not found')
    }

    const catalogProduct =
      await prisma.catalogProduct.findFirst({
        where: {
          id: catalogProductId,
          organizationId
        }
      })

    if (!catalogProduct) {
      throw new Error('Catalog product not found')
    }

    const eventProduct =
      await prisma.eventProduct.create({
        data: {
          eventId,
          catalogProductId,
          priceInCents
        }
      })

    return {
      eventProduct
    }
  }
}