import { updateEventSchema } from '../schemas/update-event-schema.js';
import { UpdateEventService } from '../services/update-event-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function updateEventController(request, reply) {
    const { id } = request.params;
    const userId = request.user.sub;
    const organizationId = getTenantOrganizationId(request);
    const data = updateEventSchema.parse(request.body);
    const updateEventService = new UpdateEventService();
    const { event } = await updateEventService.execute({
        eventId: id,
        organizationId,
        userRole: request.user.role,
        userId,
        ...data
    });
    return reply.send({
        event
    });
}
