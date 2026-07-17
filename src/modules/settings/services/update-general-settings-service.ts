import { AuditAction, Prisma } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { defaultGeneralSettings } from './settings-shared.js'

type UpdateGeneralSettingsServiceRequest = {
  organizationId: string
  userId: string
  data: Prisma.OrganizationSettingsUncheckedUpdateInput
}

export class UpdateGeneralSettingsService {
  async execute({
    organizationId,
    userId,
    data
  }: UpdateGeneralSettingsServiceRequest) {
    const settings =
      await prisma.organizationSettings.upsert({
        where: {
          organizationId
        },
        create: {
          organizationId,
          timezone:
            typeof data.timezone === 'string'
              ? data.timezone
              : defaultGeneralSettings.timezone,
          locale:
            typeof data.locale === 'string'
              ? data.locale
              : defaultGeneralSettings.locale,
          currency:
            typeof data.currency === 'string'
              ? data.currency
              : defaultGeneralSettings.currency,
          legalName: data.legalName as string | null | undefined,
          document: data.document as string | null | undefined,
          contactEmail: data.contactEmail as string | null | undefined,
          contactPhone: data.contactPhone as string | null | undefined,
          whatsapp: data.whatsapp as string | null | undefined,
          address: data.address as string | null | undefined,
          city: data.city as string | null | undefined,
          state: data.state as string | null | undefined,
          postalCode: data.postalCode as string | null | undefined
        },
        update: data
      })

    const createAuditLogService =
      new CreateAuditLogService()

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
    })

    return {
      general: settings
    }
  }
}
