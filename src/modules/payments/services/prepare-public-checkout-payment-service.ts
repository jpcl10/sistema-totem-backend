import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreatePaymentTransactionService } from './create-payment-transaction-service.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'

interface PreparePublicCheckoutPaymentServiceRequest {
  orderId: string
  context?: 'TOTEM' | 'PUBLIC_CHECKOUT'
  paymentMethod?: 'PIX' | 'CARD'
}

export class PreparePublicCheckoutPaymentService {
  async execute({
    orderId,
    context = 'PUBLIC_CHECKOUT',
    paymentMethod = 'PIX'
  }: PreparePublicCheckoutPaymentServiceRequest) {
    if (context === 'TOTEM' && paymentMethod !== 'PIX') {
      throw new Error('Totem checkout only prepares automatic PIX payments')
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId
      },
      include: {
        event: {
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
        }
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    const isPaymentConfirmed =
      order.paymentStatus === PaymentStatus.PAID ||
      order.paymentStatus === PaymentStatus.NOT_REQUIRED

    const manualPix = {
      enabled: context === 'TOTEM' ? false : order.event.pixEnabled,
      pixKey: context === 'TOTEM'
        ? null
        : order.event.pixEnabled ? order.event.pixKey : null,
      receiverName: context === 'TOTEM'
        ? null
        : order.event.pixEnabled ? order.event.pixReceiverName : null,
      city: context === 'TOTEM'
        ? null
        : order.event.pixEnabled ? order.event.pixCity : null,
      instructions: context === 'TOTEM'
        ? null
        : order.event.pixEnabled ? order.event.pixInstructions : null
    }

    if (isPaymentConfirmed) {
      return {
        paymentStep: 'paid',
        isPaymentConfirmed: true,
        order,
        manualPix,
        paymentTransaction: null,
        message: 'Pedido já está pago'
      }
    }

    if (
      order.paymentStatus === PaymentStatus.CANCELLED ||
      order.status === OrderStatus.CANCELLED
    ) {
      return {
        paymentStep: 'operator',
        isPaymentConfirmed: false,
        order,
        manualPix,
        paymentTransaction: null,
        message: 'Pedido cancelado'
      }
    }

    const mercadoPagoSettings =
      await prisma.paymentProviderSettings.findUnique({
        where: {
          organizationId_provider: {
            organizationId: order.event.organizationId,
            provider: PaymentProvider.MERCADO_PAGO
          }
        },
        select: {
          enabled: true,
          pixEnabled: true,
          accessToken: true
        }
      })

    const pixAutomaticAvailable =
      Boolean(
        mercadoPagoSettings?.enabled &&
          mercadoPagoSettings?.pixEnabled &&
          mercadoPagoSettings?.accessToken
      )

    const effectiveSettings =
      await new PaymentSettingsResolver().resolve({
        organizationId: order.event.organizationId,
        contextType: 'EVENT',
        eventId: order.eventId
      })

    if (!pixAutomaticAvailable || !effectiveSettings.methods.pix) {
      if (context === 'TOTEM') {
        return {
          paymentStep: 'pix_unavailable',
          isPaymentConfirmed: false,
          order,
          manualPix,
          paymentTransaction: null,
          message: 'PIX automático indisponível no totem. Configure Mercado Pago com PIX habilitado e token de acesso.'
        }
      }

      if (manualPix.enabled) {
        return {
          paymentStep: 'pix_manual',
          isPaymentConfirmed: false,
          order,
          manualPix,
          paymentTransaction: null,
          message: 'PIX manual disponível'
        }
      }

      return {
        paymentStep: 'operator',
        isPaymentConfirmed: false,
        order,
        manualPix,
        paymentTransaction: null,
        message: 'Nenhum método automático disponível'
      }
    }

    const existingWaitingTransaction =
      await prisma.paymentTransaction.findFirst({
        where: {
          orderId: order.id,
          provider: PaymentProvider.MERCADO_PAGO,
          method: PaymentMethod.PIX_AUTOMATIC,
          status: PaymentTransactionStatus.WAITING_PAYMENT
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

    if (
      existingWaitingTransaction &&
      (
        existingWaitingTransaction.qrCode ||
        existingWaitingTransaction.qrCodeBase64 ||
        existingWaitingTransaction.pixCopyPaste
      )
    ) {
      return {
        paymentStep: 'pix_automatic',
        isPaymentConfirmed: false,
        order,
        manualPix,
        paymentTransaction: existingWaitingTransaction,
        message: 'PIX automático aguardando pagamento'
      }
    }

    const createPaymentTransactionService =
      new CreatePaymentTransactionService()

    const { paymentTransaction } =
      await createPaymentTransactionService.execute({
        organizationId: order.event.organizationId,
        orderId: order.id,
        provider: PaymentProvider.MERCADO_PAGO,
        method: PaymentMethod.PIX_AUTOMATIC,
        amountInCents: order.totalInCents,
        metadata: {
          source: 'public-totem-checkout',
          eventId: order.eventId,
          orderId: order.id
        }
      })

    if (
      paymentTransaction.status === PaymentTransactionStatus.WAITING_PAYMENT &&
      (
        paymentTransaction.qrCode ||
        paymentTransaction.qrCodeBase64 ||
        paymentTransaction.pixCopyPaste
      )
    ) {
      return {
        paymentStep: 'pix_automatic',
        isPaymentConfirmed: false,
        order,
        manualPix,
        paymentTransaction,
        message: 'PIX automático criado'
      }
    }

    if (context !== 'TOTEM' && manualPix.enabled) {
      return {
        paymentStep: 'pix_manual',
        isPaymentConfirmed: false,
        order,
        manualPix,
        paymentTransaction,
        message: 'PIX automático indisponível, usando PIX manual'
      }
    }

    return {
      paymentStep: 'operator',
      isPaymentConfirmed: false,
      order,
      manualPix,
      paymentTransaction,
      message: 'Pagamento pendente. Procure um operador.'
    }
  }
}
