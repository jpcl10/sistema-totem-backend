import { ListOnlineStoresService } from '../services/list-online-stores-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function listOnlineStoresController(request, reply) {
    const organizationId = getTenantOrganizationId(request);
    const service = new ListOnlineStoresService();
    const result = await service.execute({
        organizationId,
        userRole: request.user.role
    });
    return reply.send(result);
}
