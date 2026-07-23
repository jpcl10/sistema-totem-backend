import { z } from 'zod';
import { GetOnlineStoreSummaryService } from '../services/get-online-store-summary-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const getOnlineStoreSummaryParamsSchema = z.object({
    storeId: z.string().min(1)
});
export async function getOnlineStoreSummaryController(request, reply) {
    const { storeId } = getOnlineStoreSummaryParamsSchema.parse(request.params);
    const organizationId = getTenantOrganizationId(request);
    const service = new GetOnlineStoreSummaryService();
    try {
        const result = await service.execute({
            storeId,
            organizationId,
            userRole: request.user.role
        });
        return reply.send(result);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Store not found') {
            return reply.status(404).send({ message: 'Loja não encontrada' });
        }
        throw error;
    }
}
