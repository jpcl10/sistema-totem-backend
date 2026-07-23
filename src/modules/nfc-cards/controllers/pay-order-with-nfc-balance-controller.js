import { z } from 'zod';
import { payOrderWithNfcBalanceSchema } from '../schemas/pay-order-with-nfc-balance-schema.js';
import { PayOrderWithNfcBalanceService } from '../services/pay-order-with-nfc-balance-service.js';
import { AmbiguousEventSlugError, buildAmbiguousEventSlugResponse } from '../../events/services/public-event-resolver.js';
const paramsSchema = z.object({
    organizationSlug: z.string().optional(),
    eventSlug: z.string(),
    orderId: z.string()
});
export async function payOrderWithNfcBalanceController(request, reply) {
    const { organizationSlug, eventSlug, orderId } = paramsSchema.parse(request.params);
    const { nfcCardId, uid } = payOrderWithNfcBalanceSchema.parse(request.body);
    const payOrderWithNfcBalanceService = new PayOrderWithNfcBalanceService();
    try {
        const result = await payOrderWithNfcBalanceService.execute({
            eventSlug,
            organizationSlug: organizationSlug ?? null,
            orderId,
            nfcCardId,
            uid
        });
        return reply.status(200).send(result);
    }
    catch (error) {
        if (error instanceof Error) {
            if (error instanceof AmbiguousEventSlugError) {
                return reply.status(409).send(buildAmbiguousEventSlugResponse(error));
            }
            if (error.message === 'Event not found' ||
                error.message === 'Order not found' ||
                error.message === 'NFC card not found') {
                return reply.status(404).send({ message: error.message });
            }
            if (error.message === 'NFC card is not active' ||
                error.message === 'Insufficient balance' ||
                error.message === 'Order is already paid' ||
                error.message === 'Order total must be greater than zero') {
                return reply.status(400).send({ message: error.message });
            }
        }
        throw error;
    }
}
