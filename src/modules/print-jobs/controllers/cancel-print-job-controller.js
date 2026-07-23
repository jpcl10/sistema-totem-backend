import { CancelPrintJobService } from '../services/cancel-print-job-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function cancelPrintJobController(request, reply) {
    const { printJobId } = request.params;
    const organizationId = getTenantOrganizationId(request);
    const service = new CancelPrintJobService();
    const { printJob } = await service.execute({
        organizationId,
        userRole: request.user.role,
        printJobId
    });
    return reply.send({
        printJob
    });
}
