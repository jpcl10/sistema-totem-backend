import { prisma } from '../../../lib/prisma.js';
export class ListPrintJobsService {
    async execute({ organizationId, eventId }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const printJobs = await prisma.eventPrintJob.findMany({
            where: {
                eventId
            },
            include: {
                printer: true,
                order: {
                    include: {
                        items: {
                            include: {
                                catalogProduct: {
                                    include: {
                                        catalogCategory: true
                                    }
                                }
                            }
                        }
                    }
                },
                event: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            printJobs
        };
    }
}
