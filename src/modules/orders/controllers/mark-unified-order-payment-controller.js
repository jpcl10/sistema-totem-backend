import { PaymentStatus } from '@prisma/client';
import { z, ZodError } from 'zod';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
import { MarkUnifiedOrderPaymentService } from '../services/mark-unified-order-payment-service.js';
const markUnifiedOrderPaymentParamsSchema = z.object({
    orderType: z.enum(['EVENT_ORDER', 'ONLINE_ORDER']),
    orderId: z.string().min(1)
});
const markUnifiedOrderPaymentBodySchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus),
    paymentMethod: z.string().nullable().optional(),
    amountReceivedInCents: z
        .number()
        .int()
        .min(0)
        .nullable()
        .optional(),
    changeInCents: z
        .number()
        .int()
        .min(0)
        .nullable()
        .optional()
});
export async function markUnifiedOrderPaymentController(request, reply) {
    try {
        const { orderType, orderId } = markUnifiedOrderPaymentParamsSchema.parse(request.params);
        const { paymentStatus, paymentMethod, amountReceivedInCents, changeInCents } = markUnifiedOrderPaymentBodySchema.parse(request.body);
        const { order } = await new MarkUnifiedOrderPaymentService().execute({
            organizationId: getTenantOrganizationId(request),
            userRole: request.user.role,
            userId: request.user.sub,
            orderType: orderType,
            orderId,
            paymentStatus,
            paymentMethod,
            amountReceivedInCents,
            changeInCents
        });
        return reply.status(200).send({
            order
        });
    }
    catch (error) {
        if (error instanceof ZodError) {
            return reply.status(400).send({
                code: 'INVALID_REQUEST',
                message: 'Invalid request',
                issues: error.issues
            });
        }
        if (error instanceof Error) {
            if (error.message === 'Order not found') {
                return reply.status(404).send({
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found'
                });
            }
            if (error.message === 'Access denied') {
                return reply.status(403).send({
                    code: 'ORDER_FORBIDDEN',
                    message: 'Access denied'
                });
            }
            if (error.message === 'Invalid payment method') {
                return reply.status(400).send({
                    code: 'INVALID_PAYMENT_METHOD',
                    message: 'Invalid payment method'
                });
            }
            if (error.message === 'Invalid payment status transition' ||
                error.message === 'Payment method is required when payment is paid') {
                return reply.status(409).send({
                    code: 'INVALID_PAYMENT_TRANSITION',
                    message: error.message
                });
            }
            if (error.message === 'Amount received cannot be negative' ||
                error.message === 'Change value cannot be negative' ||
                error.message === 'Amount paid cannot be negative' ||
                error.message === 'Amount received cannot be less than order total' ||
                error.message === 'Change value does not match amount received') {
                return reply.status(400).send({
                    code: 'INVALID_PAYMENT_AMOUNT',
                    message: error.message
                });
            }
        }
        throw error;
    }
}
