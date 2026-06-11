import {
  OrderStatus,
  PaymentStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface ListPublicCallScreenOrdersServiceRequest {
  eventSlug: string
}

export class ListPublicCallScreenOrdersService {
  async execute({
    eventSlug
  }: ListPublicCallScreenOrdersServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        slug: eventSlug,
        active: true
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const orders = await prisma.order.findMany({
      where: {
        eventId: event.id,
        status: {
          in: [
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY
          ]
        },
        paymentStatus: {
          in: [
            PaymentStatus.PAID,
            PaymentStatus.NOT_REQUIRED
          ]
        }
      },
      select: {
        id: true,
        eventId: true,
        customerName: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalInCents: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        {
          status: 'asc'
        },
        {
          updatedAt: 'asc'
        }
      ]
    })

    return {
      event,
      orders
    }
  }
}