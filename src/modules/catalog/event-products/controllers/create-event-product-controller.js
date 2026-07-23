import { createEventProductSchema } from '../schemas/create-event-product-schema.js';
import { CreateEventProductService } from '../services/create-event-product-service.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function createEventProductController(request, reply) {
    const params = request.params;
    const body = createEventProductSchema.parse(request.body);
    const userId = request.user.sub;
    const organizationId = getTenantOrganizationId(request);
    const service = new CreateEventProductService();
    try {
        const { eventProduct } = await service.execute({
            organizationId,
            userId,
            eventId: params.eventId,
            catalogProductId: body.catalogProductId,
            priceInCents: body.priceInCents,
            active: body.active,
            trackStock: body.trackStock,
            stockQuantity: body.stockQuantity
        });
        return reply.status(eventProduct.alreadyExists ? 200 : 201).send({
            eventProduct
        });
    }
    catch (error) {
        if (error instanceof Error &&
            (error.message === 'Event not found' ||
                error.message === 'Catalog product not found')) {
            return reply.status(404).send({ message: error.message });
        }
        if (error instanceof Error &&
            error.message === 'Stock quantity is required when stock tracking is enabled') {
            return reply.status(400).send({ message: error.message });
        }
        throw error;
    }
}
