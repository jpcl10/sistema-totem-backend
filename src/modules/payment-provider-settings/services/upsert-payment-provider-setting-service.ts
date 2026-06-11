import { PaymentProvider } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface UpsertPaymentProviderSettingServiceRequest {
  organizationId: string
  provider: PaymentProvider

  enabled?: boolean
  pixEnabled?: boolean
  cardEnabled?: boolean
  terminalEnabled?: boolean

  accessToken?: string | null
  publicKey?: string | null
  webhookSecret?: string | null
  webhookUrl?: string | null
}

export class UpsertPaymentProviderSettingService {
  async execute({
    organizationId,
    provider,
    enabled,
    pixEnabled,
    cardEnabled,
    terminalEnabled,
    accessToken,
    publicKey,
    webhookSecret,
    webhookUrl
  }: UpsertPaymentProviderSettingServiceRequest) {
    const setting = await prisma.paymentProviderSettings.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider
        }
      },
      create: {
        organizationId,
        provider,

        enabled: enabled ?? false,
        pixEnabled: pixEnabled ?? false,
        cardEnabled: cardEnabled ?? false,
        terminalEnabled: terminalEnabled ?? false,

        accessToken: accessToken ?? null,
        publicKey: publicKey ?? null,
        webhookSecret: webhookSecret ?? null,
        webhookUrl: webhookUrl ?? null
      },
      update: {
        ...(enabled !== undefined && {
          enabled
        }),
        ...(pixEnabled !== undefined && {
          pixEnabled
        }),
        ...(cardEnabled !== undefined && {
          cardEnabled
        }),
        ...(terminalEnabled !== undefined && {
          terminalEnabled
        }),

        ...(accessToken !== undefined && {
          accessToken
        }),
        ...(publicKey !== undefined && {
          publicKey
        }),
        ...(webhookSecret !== undefined && {
          webhookSecret
        }),
        ...(webhookUrl !== undefined && {
          webhookUrl
        })
      }
    })

    return {
      setting: {
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
    }
  }
}