import { ListPendingDevicePrintJobsService } from '../services/list-pending-device-print-jobs-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function listPendingDevicePrintJobsController(request, reply) {
    const { eventId, storeId } = request.query;
    const organizationId = getTenantOrganizationId(request);
    const service = new ListPendingDevicePrintJobsService();
    const { printJobs } = await service.execute({
        organizationId,
        eventId,
        storeId
    });
    return reply.send({
        printJobs
    });
}
