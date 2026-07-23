import { createManualSaleBodySchema, createManualSaleParamsSchema } from '../schemas/create-manual-sale-schema.js';
import { CreateManualSaleService } from '../services/create-manual-sale-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function createManualSaleController(request, reply) {
    const { eventId } = createManualSaleParamsSchema.parse(request.params);
    const body = createManualSaleBodySchema.parse(request.body);
    const organizationId = getTenantOrganizationId(request);
    const createManualSaleService = new CreateManualSaleService();
    const result = await createManualSaleService.execute({
        organizationId,
        userRole: request.user.role,
        userId: request.user.sub,
        eventId,
        customerName: body.customerName,
        customerId: body.customerId,
        paymentMethod: body.paymentMethod,
        paymentStatus: body.paymentStatus,
        items: body.items
    });
    return reply.status(201).send(result);
}
