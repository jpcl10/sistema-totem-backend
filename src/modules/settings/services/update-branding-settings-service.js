import { AuditAction } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
export class UpdateBrandingSettingsService {
    async execute({ organizationId, userId, data }) {
        const branding = await prisma.organizationBranding.upsert({
            where: {
                organizationId
            },
            create: {
                organizationId,
                ...data
            },
            update: data
        });
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId,
            userId,
            entity: 'OrganizationBranding',
            entityId: branding.id,
            action: AuditAction.SETTINGS_BRANDING_UPDATED,
            description: 'Identidade visual atualizada',
            metadata: {
                changedFields: Object.keys(data)
            }
        });
        return {
            branding
        };
    }
}
