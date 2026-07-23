import { ListDevicesService } from '../services/list-devices-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function listDevicesController(request, reply) {
    const organizationId = getTenantOrganizationId(request);
    const service = new ListDevicesService();
    const result = await service.execute({
        organizationId,
        userRole: request.user.role
    });
    return reply.send(result);
}
