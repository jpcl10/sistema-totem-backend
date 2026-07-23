import { z } from 'zod';
import { closeEventBodySchema } from '../schemas/close-event-schema.js';
import { CloseEventService } from '../services/close-event-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const closeEventParamsSchema = z.object({
    eventId: z.string().min(1)
});
export async function closeEventController(request, reply) {
    const { eventId } = closeEventParamsSchema.parse(request.params);
    const { notes, allowPendingOrders, allowPrintErrors } = closeEventBodySchema.parse(request.body ?? {});
    const closedByUserId = request.user.sub;
    const organizationId = getTenantOrganizationId(request);
    const closeEventService = new CloseEventService();
    const result = await closeEventService.execute({
        eventId,
        organizationId,
        userRole: request.user.role,
        closedByUserId,
        notes,
        allowPendingOrders,
        allowPrintErrors
    });
    return reply.status(201).send(result);
}
