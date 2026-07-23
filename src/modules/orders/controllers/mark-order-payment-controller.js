import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { z, ZodError } from 'zod';
import { MarkOrderPaymentService } from '../services/mark-order-payment-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const markOrderPaymentParamsSchema = z.object({
    orderId: z.string()
});
const markOrderPaymentBodySchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus),
    paymentMethod: z
        .nativeEnum(PaymentMethod)
        .nullable()
        .optional(),
    amountPaidInCents: z
        .number()
        .int()
        .min(0)
        .nullable()
        .optional(),
    changeForInCents: z
        .number()
        .int()
        .min(0)
        .nullable()
        .optional(),
    paymentNotes: z
        .string()
        .nullable()
        .optional()
});
export async function markOrderPaymentController(request, reply) {
    try {
        const { orderId } = markOrderPaymentParamsSchema.parse(request.params);
        const { paymentStatus, paymentMethod, amountPaidInCents, changeForInCents, paymentNotes } = markOrderPaymentBodySchema.parse(request.body);
        const userId = request.user.sub;
        const organizationId = getTenantOrganizationId(request);
        const markOrderPaymentService = new MarkOrderPaymentService();
        const { order } = await markOrderPaymentService.execute({
            organizationId,
            userRole: request.user.role,
            userId,
            orderId,
            paymentStatus,
            paymentMethod,
            amountPaidInCents,
            changeForInCents,
            paymentNotes
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
            if (error.message === 'Payment method is required when payment is paid') {
                return reply.status(409).send({
                    code: 'INVALID_PAYMENT_TRANSITION',
                    message: error.message
                });
            }
            if (error.message === 'Amount paid cannot be negative' ||
                error.message === 'Change value cannot be negative') {
                return reply.status(400).send({
                    code: 'INVALID_PAYMENT_AMOUNT',
                    message: error.message
                });
            }
        }
        throw error;
    }
}
