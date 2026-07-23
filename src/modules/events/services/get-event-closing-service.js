import { prisma } from '../../../lib/prisma.js';
export class GetEventClosingService {
    async execute({ eventId, organizationId }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            },
            select: {
                id: true,
                name: true,
                slug: true,
                active: true,
                closed: true,
                closedAt: true,
                organizationId: true
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const closing = await prisma.eventClosing.findFirst({
            where: {
                eventId,
                organizationId: event.organizationId
            },
            include: {
                closedByUser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                }
            }
        });
        if (!closing) {
            throw new Error('Event closing not found');
        }
        return {
            event,
            closing
        };
    }
}
