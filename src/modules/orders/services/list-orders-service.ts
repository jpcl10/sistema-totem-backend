import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface ListOrdersServiceRequest {
  organizationId: string
  userRole: UserRole
  eventId: string
}

export class ListOrdersService {
  async execute({
    organizationId,
    eventId
  }: ListOrdersServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const orders = await prisma.order.findMany({
      where: {
        eventId
      },
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      orders
    }
  }
}
