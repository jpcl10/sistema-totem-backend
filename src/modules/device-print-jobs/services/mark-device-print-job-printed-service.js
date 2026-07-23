import { prisma } from '../../../lib/prisma.js';
export class MarkDevicePrintJobPrintedService {
    async execute({ organizationId, printJobId }) {
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
                status: 'PRINTED',
                printedAt: new Date(),
                errorMessage: null
            }
        });
        return {
            printJob: updatedPrintJob
        };
    }
}
