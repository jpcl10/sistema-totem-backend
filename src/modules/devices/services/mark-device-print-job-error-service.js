import { prisma } from '../../../lib/prisma.js';
export class MarkDevicePrintJobErrorService {
    async execute({ printJobId, deviceId, errorMessage }) {
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
                status: 'ERROR',
                errorMessage: errorMessage ?? 'Erro não informado pelo dispositivo'
            }
        });
        return {
            printJob: updatedPrintJob
        };
    }
}
