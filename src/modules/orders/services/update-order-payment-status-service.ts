import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { mapEventOrderToUnifiedOrder } from '../presenters/unified-order-presenter.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'

interface UpdateOrderPaymentStatusServiceRequest {
  organizationId: string
  userRole: UserRole
  userId: string
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
    userId,
    orderId,
    paymentStatus
  }: UpdateOrderPaymentStatusServiceRequest) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        event: {
          organizationId
        }
      },
      include: {
        event: true
      }
    })

    if (!order) {
      throw new Error('Order not found')
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
            },
            options: true
          }
        },
        printJobs: true
      }
    })

    // Create audit log for order payment status updated
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: order.event.organizationId,
      eventId: order.eventId,
      userId,
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

    await new CreatePrintJobsForOrderService().execute({
      orderId: updatedOrder.id
    })

    io.to(`event:${order.eventId}`).emit('order-updated', {
      order: updatedOrder
    })

    io.to(`event:${order.eventId}`).emit('unified-order-updated', {
      order: mapEventOrderToUnifiedOrder({
        ...updatedOrder,
        event: order.event
      })
    })

    io.to(`organization:${organizationId}`).emit('unified-order-updated', {
      order: mapEventOrderToUnifiedOrder({
        ...updatedOrder,
        event: order.event
      })
    })

    return {
      order: updatedOrder
    }
  }
}
