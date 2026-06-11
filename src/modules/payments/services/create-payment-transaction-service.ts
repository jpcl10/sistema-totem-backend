import {
  PaymentMethod,
  PaymentProvider,
  Prisma
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { makePaymentProvider } from '../providers/payment-provider-factory.js'

interface CreatePaymentTransactionServiceRequest {
  organizationId: string
  orderId: string
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
    provider,
    method,
    amountInCents,
    externalReference,
    gatewayStatus,
    gatewayMessage,
    metadata
  }: CreatePaymentTransactionServiceRequest) {
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
        customerName: true
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    const finalAmountInCents =
      amountInCents ?? order.totalInCents

    if (finalAmountInCents <= 0) {
      throw new Error('Amount must be greater than zero')
    }

    const finalMethod =
      method ?? PaymentMethod.OTHER

    const paymentProvider =
      makePaymentProvider(provider)

    const providerResponse =
    await paymentProvider.createPayment({
    organizationId,
    orderId: order.id,
    amountInCents: finalAmountInCents,
    method: finalMethod,
    description: `Pedido #${order.orderNumber}`,
    payerName: order.customerName,
    metadata
  })

    const paymentTransaction =
      await prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
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

    return {
      paymentTransaction
    }
  }
}