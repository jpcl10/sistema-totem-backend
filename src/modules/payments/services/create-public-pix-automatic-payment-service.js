import { PaymentMethod, PaymentProvider, PaymentStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { CreatePaymentTransactionService } from './create-payment-transaction-service.js';
export class CreatePublicPixAutomaticPaymentService {
    async execute({ orderId }) {
        const order = await prisma.order.findUnique({
            where: {
                id: orderId
            },
            include: {
                event: {
                    select: {
                        id: true,
                        organizationId: true
                    }
                }
            }
        });
        if (!order) {
            throw new Error('Order not found');
        }
        if (order.paymentStatus === PaymentStatus.PAID) {
            throw new Error('Order already paid');
        }
        if (order.paymentStatus === PaymentStatus.CANCELLED) {
            throw new Error('Order payment cancelled');
        }
        if (order.status === 'CANCELLED') {
            throw new Error('Order cancelled');
        }
        const createPaymentTransactionService = new CreatePaymentTransactionService();
        const { paymentTransaction } = await createPaymentTransactionService.execute({
            organizationId: order.event.organizationId,
            orderId: order.id,
            provider: PaymentProvider.MERCADO_PAGO,
            method: PaymentMethod.PIX_AUTOMATIC,
            amountInCents: order.totalInCents,
            metadata: {
                source: 'public-totem-checkout',
                eventId: order.eventId,
                orderId: order.id
            }
        });
        return {
            paymentTransaction
        };
    }
}
