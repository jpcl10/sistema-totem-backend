import { prisma } from '../../../lib/prisma.js';
import { io } from '../../../lib/socket.js';
import { AuditAction } from '@prisma/client';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { mapEventOrderToUnifiedOrder } from '../presenters/unified-order-presenter.js';
import { OrderNotificationService } from '../../notifications/services/order-notification-service.js';
export class UpdateOrderStatusService {
    async execute({ organizationId, orderId, status, cancelReason, restoreStock }) {
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                event: {
                    organizationId
                }
            },
            include: {
                event: true,
                items: true
            }
        });
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.status === 'DELIVERED' && status === 'CANCELLED') {
            throw new Error('Delivered orders cannot be cancelled');
        }
        const isProductionStatus = status === 'PREPARING' ||
            status === 'READY' ||
            status === 'DELIVERED';
        const paymentAllowsProduction = order.paymentStatus === 'PAID' ||
            order.paymentStatus === 'NOT_REQUIRED';
        if (isProductionStatus && !paymentAllowsProduction) {
            throw new Error('Payment must be confirmed before changing order status');
        }
        const updatedOrder = await prisma.$transaction(async (tx) => {
            if (status === 'CANCELLED' && restoreStock) {
                for (const item of order.items) {
                    if (!item.catalogProductId) {
                        continue;
                    }
                    const eventProduct = await tx.eventProduct.findFirst({
                        where: {
                            eventId: order.eventId,
                            catalogProductId: item.catalogProductId
                        }
                    });
                    if (eventProduct?.trackStock &&
                        eventProduct.stockQuantity !== null) {
                        await tx.eventProduct.update({
                            where: {
                                id: eventProduct.id
                            },
                            data: {
                                stockQuantity: eventProduct.stockQuantity + item.quantity,
                                soldOut: false
                            }
                        });
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
                            },
                            options: true
                        }
                    },
                    printJobs: true
                }
            });
        });
        io.to(`event:${order.eventId}`).emit('order-updated', {
            order: updatedOrder
        });
        io.to(`event:${order.eventId}`).emit('unified-order-updated', {
            order: mapEventOrderToUnifiedOrder({
                ...updatedOrder,
                event: order.event
            })
        });
        io.to(`organization:${organizationId}`).emit('unified-order-updated', {
            order: mapEventOrderToUnifiedOrder({
                ...updatedOrder,
                event: order.event
            })
        });
        io.to(`call-screen:event:${order.eventId}`).emit('call-screen-refresh', {
            context: {
                type: 'EVENT',
                id: order.eventId
            },
            serverTime: new Date().toISOString()
        });
        const notificationPayload = {
            organizationId,
            orderId: updatedOrder.id,
            orderType: 'EVENT_ORDER',
            customerId: updatedOrder.customerId,
            customerPhone: null,
            customerName: updatedOrder.customerName,
            orderNumber: updatedOrder.orderNumber
        };
        const notificationService = new OrderNotificationService();
        if (status === 'CONFIRMED') {
            await notificationService.sendOrderConfirmed(notificationPayload);
        }
        else if (status === 'PREPARING') {
            await notificationService.sendPreparing(notificationPayload);
        }
        else if (status === 'READY') {
            await notificationService.sendReady(notificationPayload);
        }
        else if (status === 'DELIVERED') {
            await notificationService.sendDelivered(notificationPayload);
        }
        else if (status === 'CANCELLED') {
            await notificationService.sendCanceled(notificationPayload);
        }
        const createAuditLogService = new CreateAuditLogService();
        // Audit: ORDER_CANCELLED (manual)
        if (status === 'CANCELLED') {
            await createAuditLogService.execute({
                organizationId,
                eventId: order.eventId,
                entity: 'Order',
                entityId: order.id,
                action: AuditAction.ORDER_CANCELLED,
                description: 'Pedido cancelado manualmente',
                metadata: {
                    orderId: order.id,
                    motivo: cancelReason,
                    valor: order.totalInCents
                }
            });
        }
        else {
            // Audit: ORDER_UPDATED
            await createAuditLogService.execute({
                organizationId,
                eventId: order.eventId,
                entity: 'Order',
                entityId: order.id,
                action: AuditAction.ORDER_UPDATED,
                description: 'Status do pedido atualizado',
                metadata: {
                    oldStatus: order.status,
                    newStatus: status,
                    orderNumber: order.orderNumber,
                    paymentStatus: order.paymentStatus
                }
            });
        }
        return {
            order: updatedOrder
        };
    }
}
