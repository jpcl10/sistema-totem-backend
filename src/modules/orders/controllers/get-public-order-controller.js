import { prisma } from '../../../lib/prisma.js';
export async function getPublicOrderController(request, reply) {
    const { orderId } = request.params;
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
    });
    if (!order) {
        return reply.status(404).send({
            message: 'Order not found'
        });
    }
    return reply.send({
        order
    });
}
