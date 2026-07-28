import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreatePaymentTransactionService } from './create-payment-transaction-service.js'
import { PrepareOnlineCheckoutPaymentService } from './prepare-online-checkout-payment-service.js'
import { GetMercadoPagoStatusService } from '../../payment-settings/services/get-mercado-pago-status-service.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'

interface PreparePublicCheckoutPaymentServiceRequest {
  orderId: string
  context?: 'TOTEM' | 'TABLET' | 'PUBLIC_CHECKOUT'
  paymentMethod?: 'PIX' | 'CARD'
}

type PaymentTransactionWithPix = {
  id: string
  qrCode?: string | null
  qrCodeBase64?: string | null
  pixCopyPaste?: string | null
  expiresAt?: Date | string | null
}

function hasPixQrCode(transaction: PaymentTransactionWithPix | null) {
  return Boolean(
    transaction?.qrCode ||
      transaction?.qrCodeBase64 ||
      transaction?.pixCopyPaste
  )
}

function isTransactionStillValid(
  transaction: PaymentTransactionWithPix | null
): boolean {
  if (!transaction || !hasPixQrCode(transaction)) return false
  return !transaction.expiresAt || new Date(transaction.expiresAt) > new Date()
}

function pixResponseFields(transaction: PaymentTransactionWithPix) {
  return {
    transactionId: transaction.id,
    qrCode: transaction.qrCode ?? transaction.pixCopyPaste ?? undefined,
    qrCodeBase64: transaction.qrCodeBase64 ?? undefined,
    expiresAt: transaction.expiresAt
      ? new Date(transaction.expiresAt).toISOString()
      : undefined
  }
}

export class PreparePublicCheckoutPaymentService {
  async execute({
    orderId,
    context = 'PUBLIC_CHECKOUT',
    paymentMethod = 'PIX'
  }: PreparePublicCheckoutPaymentServiceRequest) {
    if ((context === 'TOTEM' || context === 'TABLET') && paymentMethod !== 'PIX') {
      throw new Error('Totem/tablet checkout only prepares automatic PIX payments')
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

    if (order) {
      const isPaymentConfirmed =
        order.paymentStatus === PaymentStatus.PAID ||
        order.paymentStatus === PaymentStatus.NOT_REQUIRED

      const manualPix = {
        enabled: context === 'TOTEM' || context === 'TABLET' ? false : order.event.pixEnabled,
        pixKey: context === 'TOTEM' || context === 'TABLET'
          ? null
          : order.event.pixEnabled ? order.event.pixKey : null,
        receiverName: context === 'TOTEM' || context === 'TABLET'
          ? null
          : order.event.pixEnabled ? order.event.pixReceiverName : null,
        city: context === 'TOTEM' || context === 'TABLET'
          ? null
          : order.event.pixEnabled ? order.event.pixCity : null,
        instructions: context === 'TOTEM' || context === 'TABLET'
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

      const mercadoPagoStatus =
        await new GetMercadoPagoStatusService().execute({
          organizationId: order.event.organizationId
        })

      const effectiveSettings =
        await new PaymentSettingsResolver().resolve({
          organizationId: order.event.organizationId,
          contextType: 'EVENT',
          eventId: order.eventId
        })

      const pixAutomaticAvailable =
        Boolean(
          mercadoPagoStatus.configured &&
            mercadoPagoStatus.pixEnabled &&
            effectiveSettings.methods.pix
        )

      if (!pixAutomaticAvailable) {
        if (context === 'TOTEM' || context === 'TABLET') {
          return {
            paymentStep: 'pix_unavailable',
            isPaymentConfirmed: false,
            order,
            manualPix,
            paymentTransaction: null,
            message: 'PIX automatico indisponivel. Configure Mercado Pago com PIX habilitado e token de acesso.'
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
        isTransactionStillValid(existingWaitingTransaction)
      ) {
        return {
          paymentStep: 'pix_automatic',
          isPaymentConfirmed: false,
          order,
          manualPix,
          ...pixResponseFields(existingWaitingTransaction),
          paymentTransaction: existingWaitingTransaction,
          message: 'PIX automático aguardando pagamento'
        }
      }

      if (existingWaitingTransaction) {
        await prisma.paymentTransaction.update({
          where: {
            id: existingWaitingTransaction.id
          },
          data: {
            status: PaymentTransactionStatus.EXPIRED,
            expiredAt: existingWaitingTransaction.expiresAt ?? new Date(),
            gatewayStatus: 'expired',
            gatewayMessage:
              'PIX expirado antes de preparar nova cobranca'
          }
        })
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
            source: context === 'TABLET' ? 'public-tablet-checkout' : 'public-totem-checkout',
            eventId: order.eventId,
            orderId: order.id
          }
        })

      if (
        paymentTransaction.status === PaymentTransactionStatus.WAITING_PAYMENT &&
        hasPixQrCode(paymentTransaction)
      ) {
        return {
          paymentStep: 'pix_automatic',
          isPaymentConfirmed: false,
          order,
          manualPix,
          ...pixResponseFields(paymentTransaction),
          paymentTransaction,
          message: 'PIX automático criado'
        }
      }

      if (context !== 'TOTEM' && context !== 'TABLET' && manualPix.enabled) {
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

    const onlineOrder = await prisma.onlineOrder.findUnique({
      where: {
        id: orderId
      }
    })

    if (!onlineOrder) {
      throw new Error('Order not found')
    }

    return new PrepareOnlineCheckoutPaymentService().execute({
      onlineOrderId: onlineOrder.id,
      paymentMethod
    })
  }
}
