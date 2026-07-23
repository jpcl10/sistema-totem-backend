import { DeleteEventProductService } from '../services/delete-event-product-service.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function deleteEventProductController(request, reply) {
    const params = request.params;
    const userId = request.user.sub;
    const organizationId = getTenantOrganizationId(request);
    const service = new DeleteEventProductService();
    try {
        await service.execute({
            organizationId,
            userId,
            eventId: params.eventId,
            eventProductId: params.eventProductId
        });
        return reply.status(204).send();
    }
    catch (error) {
        if (error instanceof Error &&
            (error.message === 'Event not found' ||
                error.message === 'Event product not found')) {
            return reply.status(404).send({ message: error.message });
        }
        throw error;
    }
}
