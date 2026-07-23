import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
import { bulkCreateEventProductsSchema } from '../schemas/bulk-create-event-products-schema.js';
import { BulkCreateEventProductsService } from '../services/bulk-create-event-products-service.js';
export async function bulkCreateEventProductsController(request, reply) {
    const params = request.params;
    const body = bulkCreateEventProductsSchema.parse(request.body);
    const organizationId = getTenantOrganizationId(request);
    const service = new BulkCreateEventProductsService();
    try {
        const result = await service.execute({
            organizationId,
            userId: request.user.sub,
            eventId: params.eventId,
            products: body.products
        });
        return reply.status(200).send(result);
    }
    catch (error) {
        if (error instanceof Error &&
            (error.message === 'Event not found' ||
                error.message === 'Catalog product not found')) {
            return reply.status(404).send({ message: error.message });
        }
        if (error instanceof Error &&
            (error.message === 'Stock quantity is required when stock tracking is enabled' ||
                error.message === 'Duplicated catalog product in request')) {
            return reply.status(400).send({ message: error.message });
        }
        throw error;
    }
}
