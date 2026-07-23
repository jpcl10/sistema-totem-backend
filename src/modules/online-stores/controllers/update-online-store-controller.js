import { updateOnlineStoreParamsSchema, updateOnlineStoreSchema } from '../schemas/update-online-store-schema.js';
import { UpdateOnlineStoreService } from '../services/update-online-store-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function updateOnlineStoreController(request, reply) {
    const { id } = updateOnlineStoreParamsSchema.parse(request.params);
    const body = updateOnlineStoreSchema.parse(request.body);
    const organizationId = getTenantOrganizationId(request);
    const service = new UpdateOnlineStoreService();
    try {
        const result = await service.execute({
            id,
            organizationId,
            userRole: request.user.role,
            ...body
        });
        return reply.send(result);
    }
    catch (error) {
        if (error instanceof Error) {
            if (error.message === 'Store not found') {
                return reply.status(404).send({ message: 'Loja não encontrada' });
            }
            if (error.message === 'Slug is already in use') {
                return reply.status(409).send({ message: 'Slug já está em uso' });
            }
        }
        throw error;
    }
}
