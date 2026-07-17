import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { UserRole, OnlineOrderStatus } from '@prisma/client'
import { mapOnlineOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js'
import { OrderNotificationService } from '../../notifications/services/order-notification-service.js'
import { canTransitionOnlineOrderStatus } from './online-order-status-flow.js'

interface UpdateOnlineOrderStatusServiceRequest {
  orderId: string
  organizationId: string
  userRole: UserRole
  status: OnlineOrderStatus
}

export class UpdateOnlineOrderStatusService {
  async execute({ orderId, organizationId, status }: UpdateOnlineOrderStatusServiceRequest) {
    // Find order and verify organization access
    const order = await prisma.onlineOrder.findFirst({
      where: {
        id: orderId,
        store: {
          organizationId
        }
      },
      include: {
        store: true
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    if (!canTransitionOnlineOrderStatus(order, status)) {
      throw new Error('Invalid status transition')
    }

    const updatedOrder = await prisma.onlineOrder.update({
      where: { id: orderId },
      data: {
        status
      },
      include: {
        store: {
          select: {
            id: true,
            slug: true,
            name: true,
            organizationId: true
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        items: {
          include: {
            options: true
          }
        }
      }
    })

    const notificationPayload = {
      organizationId: order.store.organizationId,
      orderId: updatedOrder.id,
      orderType: 'ONLINE_ORDER' as const,
      customerId: updatedOrder.customerId,
      customerPhone: updatedOrder.customerPhone,
      customerName: updatedOrder.customerName,
      orderNumber: updatedOrder.orderNumber
    }

    const notificationService = new OrderNotificationService()

    if (status === OnlineOrderStatus.CONFIRMED) {
      await notificationService.sendOrderConfirmed(notificationPayload)
    } else if (status === OnlineOrderStatus.PREPARING) {
      await notificationService.sendPreparing(notificationPayload)
    } else if (status === OnlineOrderStatus.READY) {
      await notificationService.sendReady(notificationPayload)
    } else if (status === OnlineOrderStatus.DELIVERED) {
      await notificationService.sendDelivered(notificationPayload)
    } else if (status === OnlineOrderStatus.CANCELLED) {
      await notificationService.sendCanceled(notificationPayload)
    }

    // Emit Socket.IO event
    if (io) {
      io.to(`organization:${order.store.organizationId}`).emit('online-order-updated', {
        storeId: order.storeId,
        order: updatedOrder
      })

      io.to(`organization:${order.store.organizationId}`).emit('unified-order-updated', {
        order: mapOnlineOrderToUnifiedOrder(updatedOrder)
      })

      io.to(`call-screen:store:${order.storeId}`).emit('call-screen-refresh', {
        context: {
          type: 'STORE',
          id: order.storeId
        },
        serverTime: new Date().toISOString()
      })
    }

    return {
      order: updatedOrder
    }
  }
}
