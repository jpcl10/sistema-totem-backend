import { prisma } from '../../../lib/prisma.js';
import { AuditAction } from '@prisma/client';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
export class CreateEventService {
    async execute(request) {
        const eventWithSameSlug = await prisma.event.findFirst({
            where: {
                organizationId: request.organizationId,
                slug: request.slug
            }
        });
        if (eventWithSameSlug) {
            throw new Error('Event already exists');
        }
        const event = await prisma.event.create({
            data: {
                organizationId: request.organizationId,
                name: request.name,
                slug: request.slug,
                primaryColor: request.primaryColor,
                secondaryColor: request.secondaryColor,
                logoUrl: request.logoUrl,
                startsAt: request.startsAt,
                endsAt: request.endsAt
            }
        });
        // Create audit log for event created
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId: request.organizationId,
            userId: request.userId,
            eventId: event.id,
            entity: 'Event',
            entityId: event.id,
            action: AuditAction.EVENT_CREATED,
            description: 'Evento criado',
            metadata: {
                eventId: event.id,
                name: event.name,
                slug: event.slug,
                active: event.active,
                organizationId: request.organizationId
            }
        });
        return {
            event
        };
    }
}
