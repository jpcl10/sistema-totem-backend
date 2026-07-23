import { updateNfcCardSchema } from '../schemas/update-nfc-card-schema.js';
import { UpdateNfcCardService } from '../services/update-nfc-card-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function updateNfcCardController(request, reply) {
    const paramsSchema = request.params;
    const { code, holderName, type, status, metadata } = updateNfcCardSchema.parse(request.body);
    const service = new UpdateNfcCardService();
    const organizationId = getTenantOrganizationId(request);
    const result = await service.execute({
        organizationId,
        userId: request.user.sub,
        eventId: paramsSchema.eventId,
        nfcCardId: paramsSchema.id,
        code,
        holderName,
        type,
        status,
        metadata
    });
    return reply.send(result);
}
