import { prisma } from '../../../lib/prisma.js';
import { AuditAction } from '@prisma/client';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
export class UpdateEventService {
    async execute(request) {
        const event = await prisma.event.findFirst({
            where: {
                id: request.eventId,
                organizationId: request.organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        if (request.slug) {
            const eventWithSameSlug = await prisma.event.findFirst({
                where: {
                    organizationId: event.organizationId,
                    slug: request.slug,
                    NOT: {
                        id: request.eventId
                    }
                }
            });
            if (eventWithSameSlug) {
                throw new Error('Slug already exists');
            }
        }
        // Determine which fields were changed
        const changedFields = [];
        const auditMetadata = {};
        // Check name
        if (request.name !== undefined && request.name !== event.name) {
            changedFields.push('name');
            auditMetadata.name = request.name;
        }
        else {
            auditMetadata.name = event.name;
        }
        // Check slug
        if (request.slug !== undefined && request.slug !== event.slug) {
            changedFields.push('slug');
            auditMetadata.slug = request.slug;
        }
        else {
            auditMetadata.slug = event.slug;
        }
        // Check pixEnabled
        if (request.pixEnabled !== undefined && request.pixEnabled !== event.pixEnabled) {
            changedFields.push('pixEnabled');
            auditMetadata.pixEnabled = request.pixEnabled;
        }
        else {
            auditMetadata.pixEnabled = event.pixEnabled;
        }
        // Check pixPaymentExpirationMinutes
        if (request.pixPaymentExpirationMinutes !== undefined &&
            request.pixPaymentExpirationMinutes !== event.pixPaymentExpirationMinutes) {
            changedFields.push('pixPaymentExpirationMinutes');
            auditMetadata.pixPaymentExpirationMinutes = request.pixPaymentExpirationMinutes;
        }
        else {
            auditMetadata.pixPaymentExpirationMinutes = event.pixPaymentExpirationMinutes;
        }
        // Check printingEnabled
        if (request.printingEnabled !== undefined &&
            request.printingEnabled !== event.printingEnabled) {
            changedFields.push('printingEnabled');
            auditMetadata.printingEnabled = request.printingEnabled;
        }
        else {
            auditMetadata.printingEnabled = event.printingEnabled;
        }
        // Check autoPrintEnabled
        if (request.autoPrintEnabled !== undefined &&
            request.autoPrintEnabled !== event.autoPrintEnabled) {
            changedFields.push('autoPrintEnabled');
            auditMetadata.autoPrintEnabled = request.autoPrintEnabled;
        }
        else {
            auditMetadata.autoPrintEnabled = event.autoPrintEnabled;
        }
        // Add changed fields to metadata
        if (changedFields.length > 0) {
            auditMetadata.changedFields = changedFields;
        }
        const updatedEvent = await prisma.event.update({
            where: {
                id: request.eventId
            },
            data: {
                ...(request.name !== undefined && { name: request.name }),
                ...(request.slug !== undefined && { slug: request.slug }),
                ...(request.primaryColor !== undefined && { primaryColor: request.primaryColor }),
                ...(request.secondaryColor !== undefined && { secondaryColor: request.secondaryColor }),
                ...(request.logoUrl !== undefined && { logoUrl: request.logoUrl }),
                ...(request.bannerUrl !== undefined && { bannerUrl: request.bannerUrl }),
                ...(request.totemWelcomeMessage !== undefined && {
                    totemWelcomeMessage: request.totemWelcomeMessage
                }),
                ...(request.totemBackgroundColor !== undefined && {
                    totemBackgroundColor: request.totemBackgroundColor
                }),
                ...(request.totemTextColor !== undefined && {
                    totemTextColor: request.totemTextColor
                }),
                ...(request.totemShowPrices !== undefined && {
                    totemShowPrices: request.totemShowPrices
                }),
                ...(request.totemShowLowStock !== undefined && {
                    totemShowLowStock: request.totemShowLowStock
                }),
                ...(request.totemRequireCustomerName !== undefined && {
                    totemRequireCustomerName: request.totemRequireCustomerName
                }),
                ...(request.totemAutoResetSeconds !== undefined && {
                    totemAutoResetSeconds: request.totemAutoResetSeconds
                }),
                ...(request.totemShowLogo !== undefined && {
                    totemShowLogo: request.totemShowLogo
                }),
                ...(request.totemFullscreenRecommended !== undefined && {
                    totemFullscreenRecommended: request.totemFullscreenRecommended
                }),
                ...(request.pixEnabled !== undefined && {
                    pixEnabled: request.pixEnabled
                }),
                ...(request.pixKey !== undefined && {
                    pixKey: request.pixKey
                }),
                ...(request.pixReceiverName !== undefined && {
                    pixReceiverName: request.pixReceiverName
                }),
                ...(request.pixCity !== undefined && {
                    pixCity: request.pixCity
                }),
                ...(request.pixInstructions !== undefined && {
                    pixInstructions: request.pixInstructions
                }),
                ...(request.pixPaymentExpirationMinutes !== undefined && {
                    pixPaymentExpirationMinutes: request.pixPaymentExpirationMinutes
                }),
                ...(request.printingEnabled !== undefined && {
                    printingEnabled: request.printingEnabled
                }),
                ...(request.autoPrintEnabled !== undefined && {
                    autoPrintEnabled: request.autoPrintEnabled
                }),
                ...(request.printMode !== undefined && {
                    printMode: request.printMode
                }),
                ...(request.printerPaperSize !== undefined && {
                    printerPaperSize: request.printerPaperSize
                }),
                ...(request.active !== undefined && { active: request.active }),
                ...(request.startsAt !== undefined && { startsAt: request.startsAt }),
                ...(request.endsAt !== undefined && { endsAt: request.endsAt })
            }
        });
        // Create audit log
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId: event.organizationId,
            eventId: request.eventId,
            userId: request.userId,
            entity: 'Event',
            entityId: updatedEvent.id,
            action: AuditAction.EVENT_UPDATED,
            description: 'Evento atualizado',
            metadata: auditMetadata
        });
        return {
            event: updatedEvent
        };
    }
}
