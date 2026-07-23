import {
  PaymentEnvironment,
  PaymentProvider
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { decryptPaymentCredentials } from '../payment-credentials-crypto.js'

type MercadoPagoCredentials = {
  accessToken?: string
  publicKey?: string
  webhookSecret?: string
  accountReference?: string
}

function maskReference(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const clean = value.trim()
  return `***${clean.slice(-4)}`
}

function safePublicReference(publicMetadata: unknown) {
  if (!publicMetadata || typeof publicMetadata !== 'object') return null
  const data = publicMetadata as Record<string, unknown>
  return maskReference(
    data.accountReference ??
      data.accountId ??
      data.userId ??
      data.email ??
      data.nickname
  )
}

export class GetMercadoPagoStatusService {
  async execute({ organizationId }: { organizationId: string }) {
    const organizationSettings =
      await prisma.organizationPaymentSettings.findUnique({
        where: { organizationId },
        select: {
          pixEnabled: true,
          environment: true,
          updatedAt: true
        }
      })

    const environment =
      organizationSettings?.environment ?? PaymentEnvironment.PRODUCTION

    const [credential, legacy] = await Promise.all([
      prisma.paymentProviderCredential.findFirst({
        where: {
          organizationId,
          provider: PaymentProvider.MERCADO_PAGO,
          environment,
          active: true
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.paymentProviderSettings.findUnique({
        where: {
          organizationId_provider: {
            organizationId,
            provider: PaymentProvider.MERCADO_PAGO
          }
        },
        select: {
          enabled: true,
          pixEnabled: true,
          terminalEnabled: true,
          accessToken: true,
          webhookSecret: true,
          webhookUrl: true,
          updatedAt: true
        }
      })
    ])

    let credentialReadable = true
    let decrypted: MercadoPagoCredentials | null = null

    if (credential?.encryptedCredentials) {
      try {
        decrypted = decryptPaymentCredentials<MercadoPagoCredentials>(
          credential.encryptedCredentials
        )
      } catch {
        credentialReadable = false
      }
    }

    const hasCredentialToken =
      Boolean(decrypted?.accessToken?.trim()) ||
      Boolean(legacy?.accessToken?.trim())
    const configured =
      credentialReadable &&
      (
        Boolean(credential?.encryptedCredentials && decrypted?.accessToken?.trim()) ||
        Boolean(legacy?.accessToken?.trim())
      )

    return {
      configured,
      pixEnabled: Boolean(
        organizationSettings?.pixEnabled &&
          (legacy?.pixEnabled ?? true) &&
          hasCredentialToken
      ),
      environment,
      accountReference:
        maskReference(decrypted?.accountReference) ??
        safePublicReference(credential?.publicMetadata),
      updatedAt:
        credential?.updatedAt ??
        legacy?.updatedAt ??
        organizationSettings?.updatedAt ??
        null,
      webhookReady: Boolean(
        decrypted?.webhookSecret?.trim() ||
          legacy?.webhookSecret?.trim() ||
          legacy?.webhookUrl?.trim()
      ),
      credentialReadable,
      providerActive: Boolean(legacy?.enabled ?? credential?.active ?? false),
      terminalEnabled: Boolean(legacy?.terminalEnabled ?? false)
    }
  }
}
