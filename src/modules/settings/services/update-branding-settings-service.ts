import {
  AuditAction,
  BrandingTheme
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

type BrandingData = {
  logoUrl?: string | null
  lightLogoUrl?: string | null
  darkLogoUrl?: string | null
  faviconUrl?: string | null
  bannerDesktopUrl?: string | null
  bannerMobileUrl?: string | null
  socialImageUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  backgroundColor?: string | null
  theme?: BrandingTheme
  defaultProductImageUrl?: string | null
}

type UpdateBrandingSettingsServiceRequest = {
  organizationId: string
  userId: string
  data: BrandingData
}

export class UpdateBrandingSettingsService {
  async execute({
    organizationId,
    userId,
    data
  }: UpdateBrandingSettingsServiceRequest) {
    const branding =
      await prisma.organizationBranding.upsert({
        where: {
          organizationId
        },
        create: {
          organizationId,
          ...data
        },
        update: data
      })

    const createAuditLogService =
      new CreateAuditLogService()

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
    })

    return {
      branding
    }
  }
}
