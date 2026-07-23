import { listNfcCardReadsSchema } from '../schemas/list-nfc-card-reads-schema.js';
import { ListNfcCardReadsService } from '../services/list-nfc-card-reads-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function listNfcCardReadsController(request, reply) {
    const params = request.params;
    const { page, limit } = listNfcCardReadsSchema.parse(request.query);
    const service = new ListNfcCardReadsService();
    const organizationId = getTenantOrganizationId(request);
    const result = await service.execute({
        organizationId,
        eventId: params.eventId,
        nfcCardId: params.id,
        page,
        limit
    });
    return reply.status(200).send(result);
}
