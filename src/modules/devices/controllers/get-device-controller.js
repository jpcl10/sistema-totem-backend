import { z } from 'zod';
import { GetDeviceService } from '../services/get-device-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function getDeviceController(request, reply) {
    const paramsSchema = z.object({
        id: z.string().cuid()
    });
    const { id } = paramsSchema.parse(request.params);
    const organizationId = getTenantOrganizationId(request);
    const service = new GetDeviceService();
    const result = await service.execute({
        organizationId,
        userRole: request.user.role,
        deviceId: id
    });
    return reply.send(result);
}
