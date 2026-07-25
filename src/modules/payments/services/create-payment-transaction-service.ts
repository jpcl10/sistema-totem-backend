import {
  PaymentMethod,
  PaymentProvider,
  Prisma,
  AuditAction
} from '@prisma/client'
import { logger } from '../../../lib/logger.js'
import { prisma } from '../../../lib/prisma.js'
import { makePaymentProvider } from '../providers/payment-provider-factory.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'

interface CreatePaymentTransactionServiceRequest {
  organizationId: string
  orderId?: string | null
  onlineOrderId?: string | null
  provider: PaymentProvider
  method?: PaymentMethod | null
  amountInCents?: number | null
  externalReference?: string | null
  gatewayStatus?: string | null
  gatewayMessage?: string | null
  metadata?: Prisma.InputJsonValue | null
}

export class CreatePaymentTransactionService {
  async execute({
    organizationId,
    orderId,
    onlineOrderId,
    provider,
    method,
    amountInCents,
    externalReference,
    gatewayStatus,
    gatewayMessage,
    metadata
  }: CreatePaymentTransactionServiceRequest) {
    // Validate that exactly one order type is provided
    if (!orderId && !onlineOrderId) {
      throw new Error('Either orderId or onlineOrderId must be provided')
    }

    if (orderId && onlineOrderId) {
      throw new Error('Only one of orderId or onlineOrderId can be provided')
    }

    let orderData: any
    let contextType: 'EVENT' | 'ONLINE_STORE'
    let contextId: string
    let pixExpirationMinutes = 5

    if (orderId) {
      // Fetch Totem Order
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          event: {
            organizationId
          }
        },
        select: {
          id: true,
          totalInCents: true,
          paymentStatus: true,
          eventId: true,
          orderNumber: true,
          customerName: true,
          event: {
            select: {
              pixPaymentExpirationMinutes: true
            }
          }
        }
      })

      if (!order) {
        throw new Error('Order not found')
      }

      orderData = order
      contextType = 'EVENT'
      contextId = order.eventId
      pixExpirationMinutes =
        order.event.pixPaymentExpirationMinutes ?? 5
    } else {
      // Fetch Online Store Order
      const onlineOrder = await prisma.onlineOrder.findFirst({
        where: {
          id: onlineOrderId as string,
          store: {
            organizationId
          }
        },
        select: {
          id: true,
          totalInCents: true,
          paymentStatus: true,
          storeId: true,
          orderNumber: true,
          customerName: true,
          store: {
            select: {
              id: true
            }
          }
        }
      })

      if (!onlineOrder) {
        throw new Error('Online order not found')
      }

      orderData = onlineOrder
      contextType = 'ONLINE_STORE'
      contextId = (onlineOrder as any).store.id
      // Use org default for online orders
      pixExpirationMinutes = 5
    }

    const finalAmountInCents =
      amountInCents ?? orderData.totalInCents

    if (finalAmountInCents <= 0) {
      throw new Error('Amount must be greater than zero')
    }

    const finalMethod =
      method ?? PaymentMethod.OTHER

    const paymentSettings =
      await new PaymentSettingsResolver().resolve({
        organizationId,
        contextType,
        eventId: contextType === 'EVENT' ? contextId : undefined,
        onlineStoreId: contextType === 'ONLINE_STORE' ? contextId : undefined
      })

    if (
      finalMethod === PaymentMethod.PIX_AUTOMATIC &&
      !paymentSettings.methods.pix
    ) {
      throw new Error('PIX is disabled for this context')
    }

    const expirationMinutes =
      paymentSettings.pixExpirationMinutes ??
      pixExpirationMinutes ??
      5

    const safeExpirationMinutes =
      Math.min(
        Math.max(expirationMinutes, 2),
        15
      )

    const expiresAt =
      provider === PaymentProvider.MERCADO_PAGO &&
      finalMethod === PaymentMethod.PIX_AUTOMATIC
        ? new Date(
            Date.now() +
              safeExpirationMinutes * 60 * 1000
          )
        : null

    const paymentProvider =
      makePaymentProvider(provider)

    // Use orderId or onlineOrderId depending on which one was provided
    const referenceOrderId = orderId || onlineOrderId || ''

    logger.info(
      {
        organizationId,
        referenceOrderId,
        finalMethod,
        amountInCents: finalAmountInCents,
        expiresAt: expiresAt?.toISOString() ?? null,
        metadata: {
          source: metadata,
        }
      },
      'Creating payment transaction',
    )

    const providerResponse =
      await paymentProvider.createPayment({
        organizationId,
        orderId: referenceOrderId,
        amountInCents: finalAmountInCents,
        method: finalMethod,
        description: `Pedido #${orderData.orderNumber}`,
        payerName: orderData.customerName,
        expiresAt,
        metadata
      })

    logger.info(
      {
        organizationId,
        referenceOrderId,
        provider: providerResponse.provider,
        status: providerResponse.status,
        method: providerResponse.method,
        amountInCents: providerResponse.amountInCents,
        externalId: providerResponse.externalId,
        gatewayStatus: providerResponse.gatewayStatus,
        gatewayMessage: providerResponse.gatewayMessage,
        hasQrCode: Boolean(providerResponse.qrCode),
        hasQrCodeBase64: Boolean(providerResponse.qrCodeBase64),
        hasPixCopyPaste: Boolean(providerResponse.pixCopyPaste)
      },
      'Payment provider responded',
    )

    const paymentTransaction =
      await prisma.paymentTransaction.create({
        data: {
          organizationId,
          orderId: orderId ?? null,
          onlineOrderId: onlineOrderId ?? null,
          contextType,
          eventId: contextType === 'EVENT' ? contextId : null,
          storeId: contextType === 'ONLINE_STORE' ? contextId : null,
          provider: providerResponse.provider,
          status: providerResponse.status,
          method: providerResponse.method,
          amountInCents: providerResponse.amountInCents,

          externalId: providerResponse.externalId ?? null,
          externalReference:
            providerResponse.externalReference ??
            externalReference ??
            null,

          qrCode: providerResponse.qrCode ?? null,
          qrCodeBase64: providerResponse.qrCodeBase64 ?? null,
          pixCopyPaste: providerResponse.pixCopyPaste ?? null,

          expiresAt,

          gatewayStatus:
            providerResponse.gatewayStatus ??
            gatewayStatus ??
            null,

          gatewayMessage:
            providerResponse.gatewayMessage ??
            gatewayMessage ??
            null,

          metadata:
            providerResponse.metadata ??
            metadata ??
            undefined
        }
      })

    // Audit: PAYMENT_CREATED
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      eventId: contextType === 'EVENT' ? contextId : undefined,
      entity: 'PaymentTransaction',
      entityId: paymentTransaction.id,
      action: AuditAction.PAYMENT_CREATED,
      description: 'Cobrança PIX criada',
      metadata: {
        paymentId: paymentTransaction.id,
        orderId: orderId || null,
        onlineOrderId: onlineOrderId || null,
        amountInCents: paymentTransaction.amountInCents
      }
    })

    return {
      paymentTransaction
    }
  }
}
