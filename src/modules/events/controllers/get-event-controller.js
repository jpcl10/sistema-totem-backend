import { GetEventService } from '../services/get-event-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function getEventController(request, reply) {
    const { id } = request.params;
    const organizationId = getTenantOrganizationId(request);
    const getEventService = new GetEventService();
    const { event } = await getEventService.execute({
        eventId: id,
        organizationId,
        userRole: request.user.role
    });
    return reply.send({
        event
    });
}
