import { createEventSchema } from '../schemas/create-event-schema.js';
import { CreateEventService } from '../services/create-event-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function createEventController(request, reply) {
    const { name, slug, primaryColor, secondaryColor, logoUrl, startsAt, endsAt } = createEventSchema.parse(request.body);
    const userId = request.user.sub;
    const organizationId = getTenantOrganizationId(request);
    const createEventService = new CreateEventService();
    const { event } = await createEventService.execute({
        organizationId,
        userRole: request.user.role,
        userId,
        name,
        slug,
        primaryColor,
        secondaryColor,
        logoUrl,
        startsAt,
        endsAt
    });
    return reply.status(201).send({
        event
    });
}
