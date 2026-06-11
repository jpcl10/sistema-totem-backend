import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'

interface UpdateOrderPaymentStatusServiceRequest {
  organizationId: string
  orderId: string
  paymentStatus:
    | 'NOT_REQUIRED'
    | 'PENDING'
    | 'PAID'
    | 'FAILED'
}

export class UpdateOrderPaymentStatusService {
  async execute({
    organizationId,
    orderId,
    paymentStatus
  }: UpdateOrderPaymentStatusServiceRequest) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId
      },
      include: {
        event: true
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    if (order.event.organizationId !== organizationId) {
      throw new Error('Unauthorized')
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: orderId
      },
      data: {
        paymentStatus
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
      }
    })

    io.to(`event:${order.eventId}`).emit('order-updated', {
      order: updatedOrder
    })

    return {
      order: updatedOrder
    }
  }
}