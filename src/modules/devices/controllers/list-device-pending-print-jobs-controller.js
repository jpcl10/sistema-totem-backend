import { ListDevicePendingPrintJobsService } from '../services/list-device-pending-print-jobs-service.js';
export async function listDevicePendingPrintJobsController(request, reply) {
    const deviceId = request.device.deviceId;
    const service = new ListDevicePendingPrintJobsService();
    const { printJobs } = await service.execute({
        deviceId
    });
    return reply.send({
        printJobs
    });
}
