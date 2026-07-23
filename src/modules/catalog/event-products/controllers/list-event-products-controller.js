import { ListEventProductsService } from '../services/list-event-products-service.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function listEventProductsController(request, reply) {
    const params = request.params;
    const organizationId = getTenantOrganizationId(request);
    const service = new ListEventProductsService();
    try {
        const { eventProducts } = await service.execute({
            organizationId,
            eventId: params.eventId
        });
        return reply.send({
            eventProducts
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Event not found') {
            return reply.status(404).send({ message: 'Event not found' });
        }
        throw error;
    }
}
