import { prisma } from '../../../lib/prisma.js';
export class CancelPrintJobService {
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
        if (printJob.status === 'PRINTED' || printJob.status === 'COMPLETED') {
            throw new Error('Printed job cannot be cancelled');
        }
        const updatedPrintJob = await prisma.eventPrintJob.update({
            where: {
                id: printJobId
            },
            data: {
                status: 'CANCELLED',
                errorMessage: 'Print job cancelled manually'
            }
        });
        return {
            printJob: updatedPrintJob
        };
    }
}
