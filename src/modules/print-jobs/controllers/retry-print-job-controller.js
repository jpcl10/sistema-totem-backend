import { RetryPrintJobService } from '../services/retry-print-job-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function retryPrintJobController(request, reply) {
    const { printJobId } = request.params;
    const organizationId = getTenantOrganizationId(request);
    const service = new RetryPrintJobService();
    const { printJob } = await service.execute({
        organizationId,
        userRole: request.user.role,
        printJobId
    });
    return reply.send({
        printJob
    });
}
