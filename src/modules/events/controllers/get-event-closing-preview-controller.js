import { z } from 'zod';
import { GetEventClosingPreviewService } from '../services/get-event-closing-preview-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const getEventClosingPreviewParamsSchema = z.object({
    eventId: z.string()
});
export async function getEventClosingPreviewController(request, reply) {
    const { eventId } = getEventClosingPreviewParamsSchema.parse(request.params);
    const organizationId = getTenantOrganizationId(request);
    const getEventClosingPreviewService = new GetEventClosingPreviewService();
    const result = await getEventClosingPreviewService.execute({
        eventId,
        organizationId,
        userRole: request.user.role
    });
    return reply.status(200).send(result);
}
