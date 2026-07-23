import { UserRole } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
export class RestoreEventService {
    async execute({ eventId, organizationId, userRole }) {
        if (userRole !== UserRole.SUPER_ADMIN &&
            userRole !== UserRole.ADMIN) {
            throw new Error('User does not have permission to restore events');
        }
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
                closedAt: true
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        if (event.closed) {
            throw new Error('Closed event must be reopened using the reopen endpoint');
        }
        if (event.active) {
            throw new Error('Event is already active');
        }
        const restoredEvent = await prisma.event.update({
            where: {
                id: event.id
            },
            data: {
                active: true
            },
            select: {
                id: true,
                organizationId: true,
                name: true,
                slug: true,
                active: true,
                closed: true,
                closedAt: true,
                updatedAt: true
            }
        });
        return {
            message: 'Event restored successfully',
            event: restoredEvent
        };
    }
}
