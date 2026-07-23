import { ListPrintersService } from '../services/list-printers-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function listPrintersController(request, reply) {
    const { eventId } = request.params;
    const organizationId = getTenantOrganizationId(request);
    const service = new ListPrintersService();
    const { printers } = await service.execute({
        organizationId,
        userRole: request.user.role,
        eventId
    });
    return reply.send({
        printers
    });
}
