import { ListOrdersService } from '../services/list-orders-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function listOrdersController(request, reply) {
    const { eventId } = request.params;
    const organizationId = getTenantOrganizationId(request);
    const listOrdersService = new ListOrdersService();
    const { orders } = await listOrdersService.execute({
        organizationId,
        userRole: request.user.role,
        eventId
    });
    return reply.send({
        orders
    });
}
