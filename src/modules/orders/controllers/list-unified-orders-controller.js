import { z } from 'zod';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
import { listUnifiedOrdersQuerySchema } from '../schemas/list-unified-orders-schema.js';
import { ListUnifiedOrdersService } from '../services/list-unified-orders-service.js';
export async function listUnifiedOrdersController(request, reply) {
    try {
        const organizationId = getTenantOrganizationId(request);
        const query = listUnifiedOrdersQuerySchema.parse(request.query);
        const service = new ListUnifiedOrdersService();
        return reply.send(await service.execute({
            organizationId,
            ...query
        }));
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return reply.status(400).send({
                message: 'Invalid request',
                issues: error.issues
            });
        }
        throw error;
    }
}
