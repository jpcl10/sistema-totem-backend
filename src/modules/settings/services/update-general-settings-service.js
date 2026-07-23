import { AuditAction } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { defaultGeneralSettings } from './settings-shared.js';
export class UpdateGeneralSettingsService {
    async execute({ organizationId, userId, data }) {
        const settings = await prisma.organizationSettings.upsert({
            where: {
                organizationId
            },
            create: {
                organizationId,
                timezone: typeof data.timezone === 'string'
                    ? data.timezone
                    : defaultGeneralSettings.timezone,
                locale: typeof data.locale === 'string'
                    ? data.locale
                    : defaultGeneralSettings.locale,
                currency: typeof data.currency === 'string'
                    ? data.currency
                    : defaultGeneralSettings.currency,
                legalName: data.legalName,
                document: data.document,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                whatsapp: data.whatsapp,
                address: data.address,
                city: data.city,
                state: data.state,
                postalCode: data.postalCode
            },
            update: data
        });
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId,
            userId,
            entity: 'OrganizationSettings',
            entityId: settings.id,
            action: AuditAction.SETTINGS_GENERAL_UPDATED,
            description: 'Configurações gerais atualizadas',
            metadata: {
                changedFields: Object.keys(data)
            }
        });
        return {
            general: settings
        };
    }
}
