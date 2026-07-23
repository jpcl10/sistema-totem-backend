import { MarkDevicePrintJobPrintedService } from '../services/mark-device-print-job-printed-service.js';
export async function markDevicePrintJobPrintedController(request, reply) {
    const deviceId = request.device.deviceId;
    const { id } = request.params;
    const service = new MarkDevicePrintJobPrintedService();
    const { printJob } = await service.execute({
        printJobId: id,
        deviceId
    });
    return reply.send({
        printJob
    });
}
