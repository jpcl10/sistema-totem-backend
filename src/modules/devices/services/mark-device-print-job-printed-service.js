import { prisma } from '../../../lib/prisma.js';
export class MarkDevicePrintJobPrintedService {
    async execute({ printJobId, deviceId }) {
        const printJob = await prisma.eventPrintJob.findFirst({
            where: {
                id: printJobId,
                deviceId
            }
        });
        if (!printJob) {
            throw new Error('Print job not found');
        }
        const updatedPrintJob = await prisma.eventPrintJob.update({
            where: {
                id: printJobId
            },
            data: {
                status: 'PRINTED',
                printedAt: new Date()
            }
        });
        return {
            printJob: updatedPrintJob
        };
    }
}
