import { z } from 'zod';
import { MarkDevicePrintJobErrorService } from '../services/mark-device-print-job-error-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const markDevicePrintJobErrorBodySchema = z.object({
    errorMessage: z.string().optional()
});
export async function markDevicePrintJobErrorController(request, reply) {
    const { printJobId } = request.params;
    const body = markDevicePrintJobErrorBodySchema.parse(request.body ?? {});
    const organizationId = getTenantOrganizationId(request);
    const service = new MarkDevicePrintJobErrorService();
    const { printJob } = await service.execute({
        organizationId,
        printJobId,
        errorMessage: body.errorMessage
    });
    return reply.send({
        printJob
    });
}
