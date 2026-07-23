import { ExpirePendingPixPaymentsService } from '../services/expire-pending-pix-payments-service.js';
export async function expirePendingPixPaymentsController(request, reply) {
    const service = new ExpirePendingPixPaymentsService();
    const result = await service.execute();
    return reply.status(200).send(result);
}
