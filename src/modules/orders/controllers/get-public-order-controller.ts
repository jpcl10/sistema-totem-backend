import { FastifyReply, FastifyRequest } from 'fastify'

import { prisma } from '../../../lib/prisma.js'

export async function getPublicOrderController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } = request.params as {
    orderId: string
  }

  const order = await prisma.order.findUnique({
    where: {
      id: orderId
    },
    select: {
      id: true,
      eventId: true,
      deviceId: true,
      customerName: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      totalInCents: true,
      amountPaidInCents: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitPriceInCents: true,
          totalInCents: true,
          productName: true
        }
      }
    }
  })

  if (order) {
    return reply.send({
      order
    })
  }

  const onlineOrder = await prisma.onlineOrder.findUnique({
    where: {
      id: orderId
    },
    select: {
      id: true,
      storeId: true,
      orderNumber: true,
      customerName: true,
      customerPhone: true,
      deliveryAddress: true,
      deliveryNumber: true,
      deliveryNeighborhood: true,
      deliveryCity: true,
      deliveryState: true,
      deliveryPostalCode: true,
      deliveryComplement: true,
      deliveryReference: true,
      paymentMethod: true,
      paymentStatus: true,
      source: true,
      fulfillmentType: true,
      subtotalInCents: true,
      deliveryFeeInCents: true,
      totalInCents: true,
      status: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      notes: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitPriceInCents: true,
          totalInCents: true,
          productName: true,
          notes: true
        }
      }
    }
  })

  if (!onlineOrder) {
    return reply.status(404).send({
      message: 'Order not found'
    })
  }

  return reply.send({
    order: onlineOrder
  })
}