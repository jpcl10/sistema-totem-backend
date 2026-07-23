import { prisma } from '../../../lib/prisma.js';
export class ListEventsService {
    async execute({ organizationId }) {
        const events = await prisma.event.findMany({
            where: {
                organizationId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            events
        };
    }
}
