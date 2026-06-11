import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'

interface UpdateOrderStatusServiceRequest {
  organizationId: string

  orderId: string

  status:
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY'
    | 'DELIVERED'
    | 'CANCELLED'

  cancelReason?: string | null
  restoreStock?: boolean
}

export class UpdateOrderStatusService {
  async execute({
    organizationId,
    orderId,
    status,
    cancelReason,
    restoreStock
  }: UpdateOrderStatusServiceRequest) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId
      },
      include: {
        event: true,
        items: true
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    if (order.event.organizationId !== organizationId) {
      throw new Error('Unauthorized')
    }

    if (order.status === 'DELIVERED' && status === 'CANCELLED') {
      throw new Error('Delivered orders cannot be cancelled')
    }

    const isProductionStatus =
      status === 'PREPARING' ||
      status === 'READY' ||
      status === 'DELIVERED'

    const paymentAllowsProduction =
      order.paymentStatus === 'PAID' ||
      order.paymentStatus === 'NOT_REQUIRED'

    if (isProductionStatus && !paymentAllowsProduction) {
      throw new Error(
        'Payment must be confirmed before changing order status'
      )
    }

    const updatedOrder = await prisma.$transaction(async tx => {
      if (status === 'CANCELLED' && restoreStock) {
        for (const item of order.items) {
          if (!item.catalogProductId) {
            continue
          }

          const eventProduct = await tx.eventProduct.findFirst({
            where: {
              eventId: order.eventId,
              catalogProductId: item.catalogProductId
            }
          })

          if (
            eventProduct?.trackStock &&
            eventProduct.stockQuantity !== null
          ) {
            await tx.eventProduct.update({
              where: {
                id: eventProduct.id
              },
              data: {
                stockQuantity:
                  eventProduct.stockQuantity + item.quantity,
                soldOut: false
              }
            })
          }
        }
      }

      return tx.order.update({
        where: {
          id: orderId
        },
        data: {
          status,

          ...(status === 'CANCELLED' && {
            cancelReason,
            cancelledAt: new Date()
          })
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
    })

    io.to(`event:${order.eventId}`).emit('order-updated', {
      order: updatedOrder
    })

    return {
      order: updatedOrder
    }
  }
}