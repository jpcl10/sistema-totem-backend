import { OnlineOrderPaymentMethod, PaymentStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { io } from '../../../lib/socket.js';
import { mapOnlineOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js';
import { OrderPrintOrchestratorService } from '../../print-jobs/services/order-print-orchestrator-service.js';
const onlineOrderInclude = {
    store: {
        select: {
            id: true,
            slug: true,
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
    }
};
export class MarkOnlineOrderPaymentService {
    async execute({ organizationId, orderId, paymentStatus, paymentMethod, amountReceivedInCents, changeInCents }) {
        if (paymentStatus !== PaymentStatus.PAID) {
            throw new Error('Invalid payment status transition');
        }
        if (amountReceivedInCents !== undefined &&
            amountReceivedInCents !== null &&
            amountReceivedInCents < 0) {
            throw new Error('Amount received cannot be negative');
        }
        if (changeInCents !== undefined &&
            changeInCents !== null &&
            changeInCents < 0) {
            throw new Error('Change value cannot be negative');
        }
        const order = await prisma.onlineOrder.findUnique({
            where: {
                id: orderId
            },
            include: {
                store: {
                    select: {
                        id: true,
                        organizationId: true
                    }
                },
                printJobs: {
                    select: {
                        id: true
                    }
                }
            }
        });
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.store.organizationId !== organizationId) {
            throw new Error('Access denied');
        }
        const effectivePaymentMethod = paymentMethod ?? order.paymentMethod;
        if (!effectivePaymentMethod) {
            throw new Error('Payment method is required when payment is paid');
        }
        if (effectivePaymentMethod === OnlineOrderPaymentMethod.CASH &&
            amountReceivedInCents !== undefined &&
            amountReceivedInCents !== null) {
            if (amountReceivedInCents < order.totalInCents) {
                throw new Error('Amount received cannot be less than order total');
            }
            const expectedChangeInCents = amountReceivedInCents - order.totalInCents;
            if (changeInCents !== undefined &&
                changeInCents !== null &&
                changeInCents !== expectedChangeInCents) {
                throw new Error('Change value does not match amount received');
            }
        }
        if (order.paymentStatus !== PaymentStatus.PENDING) {
            if (order.paymentStatus === PaymentStatus.PAID) {
                await new OrderPrintOrchestratorService().execute({
                    domain: 'ONLINE_ORDER',
                    orderId: order.id
                });
                const paidOrder = await prisma.onlineOrder.findUniqueOrThrow({
                    where: {
                        id: order.id
                    },
                    include: onlineOrderInclude
                });
                return {
                    order: mapOnlineOrderToUnifiedOrder(paidOrder)
                };
            }
            throw new Error('Invalid payment status transition');
        }
        const updatedOrder = await prisma.onlineOrder.update({
            where: {
                id: order.id
            },
            data: {
                paymentStatus: PaymentStatus.PAID,
                paymentMethod: effectivePaymentMethod,
                paidAt: new Date(),
                changeForInCents: effectivePaymentMethod === OnlineOrderPaymentMethod.CASH
                    ? changeInCents ??
                        (amountReceivedInCents !== undefined &&
                            amountReceivedInCents !== null
                            ? amountReceivedInCents - order.totalInCents
                            : order.changeForInCents)
                    : null
            },
            include: onlineOrderInclude
        });
        await new OrderPrintOrchestratorService().execute({
            domain: 'ONLINE_ORDER',
            orderId: updatedOrder.id
        });
        const orderWithPrintJobs = await prisma.onlineOrder.findUniqueOrThrow({
            where: {
                id: updatedOrder.id
            },
            include: onlineOrderInclude
        });
        const unifiedOrder = mapOnlineOrderToUnifiedOrder(orderWithPrintJobs);
        if (io) {
            io.to(`organization:${organizationId}`).emit('online-order-updated', {
                storeId: orderWithPrintJobs.storeId,
                order: orderWithPrintJobs
            });
            io.to(`organization:${organizationId}`).emit('unified-order-updated', {
                order: unifiedOrder
            });
        }
        return {
            order: unifiedOrder
        };
    }
}
