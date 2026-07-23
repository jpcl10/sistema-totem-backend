import { BlockNfcCardService } from '../services/block-nfc-card-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function blockNfcCardController(request, reply) {
    const paramsSchema = request.params;
    const service = new BlockNfcCardService();
    const organizationId = getTenantOrganizationId(request);
    const result = await service.execute({
        organizationId,
        userId: request.user.sub,
        eventId: paramsSchema.eventId,
        nfcCardId: paramsSchema.id
    });
    return reply.send(result);
}
