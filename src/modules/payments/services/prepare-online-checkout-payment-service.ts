import {
  OnlineOrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreatePaymentTransactionService } from './create-payment-transaction-service.js'
import { GetMercadoPagoStatusService } from '../../payment-settings/services/get-mercado-pago-status-service.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'

interface PrepareOnlineCheckoutPaymentServiceRequest {
  onlineOrderId: string
  paymentMethod?: 'PIX' | 'CARD' | 'CASH'
}

export class PrepareOnlineCheckoutPaymentService {
  async execute({
    onlineOrderId,
    paymentMethod = 'PIX'
  }: PrepareOnlineCheckoutPaymentServiceRequest) {
    const onlineOrder = await prisma.onlineOrder.findUnique({
      where: {
        id: onlineOrderId
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true
          }
        }
      }
    })

    if (!onlineOrder) {
      throw new Error('Online order not found')
    }

    // Check if payment is already confirmed
    const isPaymentConfirmed =
      onlineOrder.paymentStatus === PaymentStatus.PAID ||
      onlineOrder.paymentStatus === PaymentStatus.NOT_REQUIRED

    if (isPaymentConfirmed) {
      return {
        paymentStep: 'paid',
        isPaymentConfirmed: true,
        onlineOrder,
        paymentTransaction: null,
        message: 'Pedido já está pago'
      }
    }

    // Check if order is cancelled
    if (
      onlineOrder.paymentStatus === PaymentStatus.CANCELLED ||
      onlineOrder.status === OnlineOrderStatus.CANCELLED
    ) {
      return {
        paymentStep: 'cancelled',
        isPaymentConfirmed: false,
        onlineOrder,
        paymentTransaction: null,
        message: 'Pedido foi cancelado'
      }
    }

    // Only PIX requires payment transaction
    if (paymentMethod !== 'PIX') {
      // Cash and card on delivery don't need payment transaction
      return {
        paymentStep: 'non_payment_method',
        isPaymentConfirmed: false,
        onlineOrder,
        paymentTransaction: null,
        message: `${paymentMethod} será pago na entrega/retirada`
      }
    }

    // For PIX, check MP configuration
    const mercadoPagoStatus =
      await new GetMercadoPagoStatusService().execute({
        organizationId: onlineOrder.store.organizationId
      })

    const effectiveSettings =
      await new PaymentSettingsResolver().resolve({
        organizationId: onlineOrder.store.organizationId,
        contextType: 'ONLINE_STORE',
        onlineStoreId: onlineOrder.store.id
      })

    const pixAutomaticAvailable =
      Boolean(
        mercadoPagoStatus.configured &&
          mercadoPagoStatus.pixEnabled &&
          effectiveSettings.methods.pix
      )

    if (!pixAutomaticAvailable) {
      return {
        paymentStep: 'pix_unavailable',
        isPaymentConfirmed: false,
        onlineOrder,
        paymentTransaction: null,
        message: 'PIX não está disponível. Selecione outro método de pagamento.'
      }
    }

    // Check if there's already a waiting PIX transaction with QR code
    const existingWaitingTransaction =
      await prisma.paymentTransaction.findFirst({
        where: {
          onlineOrderId: onlineOrder.id,
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
      ) &&
      (!existingWaitingTransaction.expiresAt ||
        existingWaitingTransaction.expiresAt > new Date())
    ) {
      return {
        paymentStep: 'pix_automatic',
        isPaymentConfirmed: false,
        onlineOrder,
        paymentTransaction: existingWaitingTransaction,
        message: 'PIX aguardando pagamento'
      }
    }

    // Create new PIX payment transaction
    const createPaymentTransactionService =
      new CreatePaymentTransactionService()

    const { paymentTransaction } =
      await createPaymentTransactionService.execute({
        organizationId: onlineOrder.store.organizationId,
        onlineOrderId: onlineOrder.id,
        provider: PaymentProvider.MERCADO_PAGO,
        method: PaymentMethod.PIX_AUTOMATIC,
        amountInCents: onlineOrder.totalInCents,
        metadata: {
          source: 'online-store-checkout',
          storeId: onlineOrder.store.id,
          onlineOrderId: onlineOrder.id,
          orderNumber: onlineOrder.orderNumber
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
        onlineOrder,
        paymentTransaction,
        message: 'PIX criado com sucesso'
      }
    }

    return {
      paymentStep: 'payment_error',
      isPaymentConfirmed: false,
      onlineOrder,
      paymentTransaction,
      message: 'Não foi possível criar pagamento PIX. Tente novamente ou selecione outro método.'
    }
  }
}
