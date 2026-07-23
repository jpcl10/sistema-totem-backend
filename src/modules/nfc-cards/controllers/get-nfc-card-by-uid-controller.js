import { GetNfcCardByUidService } from '../services/get-nfc-card-by-uid-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function getNfcCardByUidController(request, reply) {
    const paramsSchema = request.params;
    const service = new GetNfcCardByUidService();
    const organizationId = getTenantOrganizationId(request);
    const result = await service.execute({
        organizationId,
        userId: request.user.sub,
        eventId: paramsSchema.eventId,
        uid: paramsSchema.uid
    });
    return reply.send(result);
}
