import { PaymentProvider } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'

interface GetCheckoutPaymentSettingsServiceRequest {
  eventId: string
  context?: 'TOTEM' | 'PUBLIC_CHECKOUT'
}

export class GetCheckoutPaymentSettingsService {
  async execute({
    eventId,
    context = 'PUBLIC_CHECKOUT'
  }: GetCheckoutPaymentSettingsServiceRequest) {
    const event = await prisma.event.findUnique({
      where: {
        id: eventId
      },
      select: {
        id: true,
        name: true,
        organizationId: true,

        pixEnabled: true,
        pixKey: true,
        pixReceiverName: true,
        pixCity: true,
        pixInstructions: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const mercadoPagoSettings =
      await prisma.paymentProviderSettings.findUnique({
        where: {
          organizationId_provider: {
            organizationId: event.organizationId,
            provider: PaymentProvider.MERCADO_PAGO
          }
        },
        select: {
          enabled: true,
          pixEnabled: true,
          cardEnabled: true,
          terminalEnabled: true,
          accessToken: true,
          publicKey: true,
          webhookSecret: true,
          webhookUrl: true
        }
      })

    const effectiveSettings =
      await new PaymentSettingsResolver().resolve({
        organizationId: event.organizationId,
        contextType: 'EVENT',
        eventId: event.id
      })

    const mercadoPagoEnabled =
      Boolean(mercadoPagoSettings?.enabled)

    const mercadoPagoPixEnabled =
      Boolean(
        mercadoPagoSettings?.pixEnabled &&
          effectiveSettings.methods.pix
      )

    const mercadoPagoAccessTokenConfigured =
      Boolean(mercadoPagoSettings?.accessToken)

    const activePaymentTerminals =
      await prisma.paymentTerminal.count({
        where: {
          organizationId: event.organizationId,
          active: true,
          status: 'ACTIVE',
          OR: [
            {
              eventId: event.id
            },
            {
              eventId: null,
              onlineStoreId: null
            }
          ]
        }
      })

    const cardAvailable =
      Boolean(
        (effectiveSettings.methods.credit || effectiveSettings.methods.debit) &&
          (
            mercadoPagoSettings?.cardEnabled === true ||
            mercadoPagoSettings?.terminalEnabled === true ||
            activePaymentTerminals > 0
          )
      )

    return {
      checkoutPaymentSettings: {
        context,
        event: {
          id: event.id,
          name: event.name
        },

        manualPix: {
          enabled: context === 'TOTEM' ? false : event.pixEnabled,
          pixKey: context === 'TOTEM'
            ? null
            : event.pixEnabled ? event.pixKey : null,
          receiverName: context === 'TOTEM'
            ? null
            : event.pixEnabled ? event.pixReceiverName : null,
          city: context === 'TOTEM'
            ? null
            : event.pixEnabled ? event.pixCity : null,
          instructions: context === 'TOTEM'
            ? null
            : event.pixEnabled ? event.pixInstructions : null
        },

        mercadoPago: {
          enabled: mercadoPagoEnabled,
          pixEnabled: mercadoPagoPixEnabled,
          cardEnabled: mercadoPagoSettings?.cardEnabled ?? false,
          terminalEnabled: mercadoPagoSettings?.terminalEnabled ?? false,

          accessTokenConfigured: mercadoPagoAccessTokenConfigured,
          publicKeyConfigured: Boolean(mercadoPagoSettings?.publicKey),
          webhookSecretConfigured: Boolean(mercadoPagoSettings?.webhookSecret),
          webhookUrlConfigured: Boolean(mercadoPagoSettings?.webhookUrl),

          pixAutomaticAvailable:
            mercadoPagoEnabled &&
            mercadoPagoPixEnabled &&
            mercadoPagoAccessTokenConfigured
        },

        totem: {
          allowedPaymentMethods: ['PIX', 'CARD'],
          pixAvailable:
            mercadoPagoEnabled &&
            mercadoPagoPixEnabled &&
            mercadoPagoAccessTokenConfigured,
          cardAvailable,
          unavailablePixReason:
            mercadoPagoEnabled &&
            mercadoPagoPixEnabled &&
            mercadoPagoAccessTokenConfigured
              ? null
              : 'PIX automático indisponível. Configure Mercado Pago com PIX e token de acesso para usar PIX no totem.'
        }
      }
    }
  }
}
