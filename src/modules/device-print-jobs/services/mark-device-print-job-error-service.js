import { prisma } from '../../../lib/prisma.js';
export class MarkDevicePrintJobErrorService {
    async execute({ organizationId, printJobId, errorMessage }) {
        const printJob = await prisma.eventPrintJob.findFirst({
            where: {
                id: printJobId,
                OR: [
                    {
                        event: {
                            organizationId
                        }
                    },
                    {
                        store: {
                            organizationId
                        }
                    }
                ]
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
                errorMessage: errorMessage ?? 'Device print error'
            }
        });
        return {
            printJob: updatedPrintJob
        };
    }
}
