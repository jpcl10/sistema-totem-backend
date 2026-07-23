import { prisma } from '../../../lib/prisma.js';
export class ListOrderPaymentTransactionsService {
    async execute({ organizationId, orderId }) {
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                event: {
                    organizationId
                }
            },
            select: {
                id: true,
                eventId: true,
                orderNumber: true,
                customerName: true,
                totalInCents: true,
                paymentStatus: true,
                paymentMethod: true
            }
        });
        if (!order) {
            throw new Error('Order not found');
        }
        const paymentTransactions = await prisma.paymentTransaction.findMany({
            where: {
                orderId: order.id
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            order,
            paymentTransactions
        };
    }
}
