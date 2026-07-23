import { prisma } from '../../../lib/prisma.js';
export class ListPrintersService {
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
        const printers = await prisma.eventPrinter.findMany({
            where: {
                eventId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            printers
        };
    }
}
