import { prisma } from '../../../lib/prisma.js';
export class MarkPrintJobPrintedService {
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
                completedAt: new Date(),
                errorMessage: null,
                lockedAt: null,
                lockedBy: null
            }
        });
        return {
            printJob: updatedPrintJob
        };
    }
}
