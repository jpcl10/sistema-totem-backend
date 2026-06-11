import { prisma } from '../../../lib/prisma.js'

interface ListPaymentProviderSettingsServiceRequest {
  organizationId: string
}

export class ListPaymentProviderSettingsService {
  async execute({
    organizationId
  }: ListPaymentProviderSettingsServiceRequest) {
    const settings = await prisma.paymentProviderSettings.findMany({
      where: {
        organizationId
      },
      orderBy: {
        provider: 'asc'
      }
    })

    const safeSettings = settings.map((setting) => {
      return {
        id: setting.id,
        organizationId: setting.organizationId,
        provider: setting.provider,

        enabled: setting.enabled,

        pixEnabled: setting.pixEnabled,
        cardEnabled: setting.cardEnabled,
        terminalEnabled: setting.terminalEnabled,

        accessTokenConfigured: Boolean(setting.accessToken),
        publicKeyConfigured: Boolean(setting.publicKey),
        webhookSecretConfigured: Boolean(setting.webhookSecret),

        webhookUrl: setting.webhookUrl,

        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt
      }
    })

    return {
      settings: safeSettings
    }
  }
}