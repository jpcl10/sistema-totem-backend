import { MarkDevicePrintJobPrintedService } from '../services/mark-device-print-job-printed-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function markDevicePrintJobPrintedController(request, reply) {
    const { printJobId } = request.params;
    const organizationId = getTenantOrganizationId(request);
    const service = new MarkDevicePrintJobPrintedService();
    const { printJob } = await service.execute({
        organizationId,
        printJobId
    });
    return reply.send({
        printJob
    });
}
