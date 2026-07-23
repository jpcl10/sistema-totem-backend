import { PaymentTransactionStatus } from '@prisma/client';
import { z } from 'zod';
import { UpdatePaymentTransactionStatusService } from '../services/update-payment-transaction-status-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const updatePaymentTransactionStatusParamsSchema = z.object({
    paymentTransactionId: z.string()
});
const updatePaymentTransactionStatusBodySchema = z.object({
    status: z.nativeEnum(PaymentTransactionStatus),
    gatewayStatus: z
        .string()
        .nullable()
        .optional(),
    gatewayMessage: z
        .string()
        .nullable()
        .optional(),
    errorMessage: z
        .string()
        .nullable()
        .optional(),
    metadata: z
        .unknown()
        .nullable()
        .optional()
});
export async function updatePaymentTransactionStatusController(request, reply) {
    const { paymentTransactionId } = updatePaymentTransactionStatusParamsSchema.parse(request.params);
    const { status, gatewayStatus, gatewayMessage, errorMessage, metadata } = updatePaymentTransactionStatusBodySchema.parse(request.body);
    const organizationId = getTenantOrganizationId(request);
    const updatePaymentTransactionStatusService = new UpdatePaymentTransactionStatusService();
    const { paymentTransaction, order } = await updatePaymentTransactionStatusService.execute({
        organizationId,
        paymentTransactionId,
        status,
        gatewayStatus,
        gatewayMessage,
        errorMessage,
        metadata: metadata
    });
    return reply.status(200).send({
        paymentTransaction,
        order
    });
}
