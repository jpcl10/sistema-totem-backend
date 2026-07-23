import { OrderStatus, PaymentStatus, PaymentTransactionStatus, PaymentMethod, PaymentProvider, AuditAction } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { io } from '../../../lib/socket.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { mapEventOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js';
export class ExpirePendingPixPaymentsService {
    async execute() {
        const now = new Date();
        const transactions = await prisma.paymentTransaction.findMany({
            where: {
                provider: PaymentProvider.MERCADO_PAGO,
                method: PaymentMethod.PIX_AUTOMATIC,
                expiresAt: {
                    lte: now
                },
                status: {
                    in: [
                        PaymentTransactionStatus.WAITING_PAYMENT,
                        PaymentTransactionStatus.CANCELLED
                    ]
                },
                orderId: {
                    not: null
                },
                order: {
                    is: {
                        status: {
                            not: OrderStatus.CANCELLED
                        },
                        paymentStatus: {
                            not: PaymentStatus.PAID
                        }
                    }
                }
            },
            include: {
                order: {
                    include: {
                        event: true
                    }
                }
            }
        });
        for (const transaction of transactions) {
            if (!transaction.order || !transaction.orderId) {
                continue;
            }
            const orderId = transaction.orderId;
            await prisma.$transaction(async (tx) => {
                await tx.paymentTransaction.update({
                    where: {
                        id: transaction.id
                    },
                    data: {
                        status: PaymentTransactionStatus.EXPIRED,
                        expiredAt: transaction.expiredAt ?? now,
                        gatewayStatus: 'expired',
                        gatewayMessage: 'PIX expirado por tempo limite'
                    }
                });
                await tx.order.update({
                    where: {
                        id: orderId
                    },
                    data: {
                        status: OrderStatus.CANCELLED,
                        paymentStatus: PaymentStatus.FAILED,
                        cancelReason: 'PIX expirado por falta de pagamento',
                        cancelledAt: now,
                        paymentNotes: 'Pagamento PIX expirado automaticamente'
                    }
                });
            });
            const updatedOrder = await prisma.order.findUniqueOrThrow({
                where: {
                    id: orderId
                },
                include: {
                    items: true,
                    event: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            organizationId: true
                        }
                    }
                }
            });
            // Audit: PAYMENT_EXPIRED
            const createAuditLogService = new CreateAuditLogService();
            await createAuditLogService.execute({
                organizationId: updatedOrder.event.organizationId,
                eventId: updatedOrder.eventId,
                entity: 'PaymentTransaction',
                entityId: transaction.id,
                action: AuditAction.PAYMENT_EXPIRED,
                description: 'Pagamento PIX expirado',
                metadata: {
                    paymentId: transaction.id,
                    orderId: updatedOrder.id,
                    expiresAt: transaction.expiresAt?.toISOString()
                }
            });
            // Audit: ORDER_CANCELLED (auto)
            await createAuditLogService.execute({
                organizationId: updatedOrder.event.organizationId,
                eventId: updatedOrder.eventId,
                entity: 'Order',
                entityId: updatedOrder.id,
                action: AuditAction.ORDER_CANCELLED,
                description: 'Pedido cancelado automaticamente por expiração do PIX',
                metadata: {
                    orderId: updatedOrder.id,
                    motivo: 'PIX expirado por falta de pagamento',
                    valor: updatedOrder.totalInCents
                }
            });
            io.to(`event:${updatedOrder.eventId}`).emit('order-updated', {
                order: updatedOrder
            });
            io.to(`event:${updatedOrder.eventId}`).emit('payment-expired', {
                order: updatedOrder,
                paymentTransactionId: transaction.id
            });
            const unifiedOrder = await prisma.order.findUnique({
                where: {
                    id: updatedOrder.id
                },
                include: {
                    event: {
                        select: {
                            id: true,
                            name: true,
                            organizationId: true,
                            printingEnabled: true
                        }
                    },
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }
                    },
                    device: {
                        select: {
                            id: true,
                            type: true,
                            name: true
                        }
                    },
                    items: {
                        include: {
                            options: true
                        }
                    },
                    printJobs: {
                        select: {
                            id: true,
                            status: true
                        }
                    },
                    paymentTransactions: {
                        select: {
                            id: true
                        }
                    }
                }
            });
            if (unifiedOrder) {
                const unifiedPayload = {
                    order: mapEventOrderToUnifiedOrder(unifiedOrder)
                };
                io.to(`event:${updatedOrder.eventId}`).emit('unified-order-updated', unifiedPayload);
                io.to(`organization:${updatedOrder.event.organizationId}`).emit('unified-order-updated', unifiedPayload);
            }
        }
        return {
            success: true,
            expiredCount: transactions.length
        };
    }
}
