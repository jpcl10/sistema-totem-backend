import { prisma } from '../../../lib/prisma.js';
export class GetEventService {
    async execute({ eventId, organizationId }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        return {
            event
        };
    }
}
