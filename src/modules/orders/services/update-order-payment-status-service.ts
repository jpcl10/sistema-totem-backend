import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

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

    // Create audit log for order payment status updated
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: order.event.organizationId,
      eventId: order.eventId,
      entity: 'Order',
      entityId: order.id,
      action: AuditAction.ORDER_PAYMENT_STATUS_UPDATED,
      description: 'Status de pagamento do pedido atualizado',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        oldPaymentStatus: order.paymentStatus,
        newPaymentStatus: paymentStatus
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