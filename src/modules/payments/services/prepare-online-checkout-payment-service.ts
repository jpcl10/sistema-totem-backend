import {
  OnlineOrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { logger } from '../../../lib/logger.js'
import { CreatePaymentTransactionService } from './create-payment-transaction-service.js'
import { GetMercadoPagoStatusService } from '../../payment-settings/services/get-mercado-pago-status-service.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'

interface PrepareOnlineCheckoutPaymentServiceRequest {
  onlineOrderId: string
  paymentMethod?: 'PIX' | 'CARD' | 'CASH'
}

type PaymentTransactionLike = {
  id: string
  method?: string | null
  status?: string | null
  qrCode?: string | null
  qrCodeBase64?: string | null
  pixCopyPaste?: string | null
  gatewayStatus?: string | null
  expiresAt?: Date | string | null
  metadata?: unknown
}

function buildPaymentPreparation(
  paymentStep: string,
  isPaymentConfirmed: boolean,
  paymentTransaction: PaymentTransactionLike | null,
  message: string
) {
  const metadata =
    paymentTransaction?.metadata && typeof paymentTransaction.metadata === 'object'
      ? paymentTransaction.metadata as Record<string, unknown>
      : null

  return {
    paymentStep,
    isPaymentConfirmed,
    transactionId: paymentTransaction?.id ?? null,
    status: paymentTransaction?.status ?? null,
    paymentMethod: paymentTransaction?.method ?? null,
    paymentStatus: paymentTransaction?.status ?? null,
    providerStatus: paymentTransaction?.gatewayStatus ?? null,
    qrCode: paymentTransaction?.qrCode ?? paymentTransaction?.pixCopyPaste ?? undefined,
    qrCodeBase64: paymentTransaction?.qrCodeBase64 ?? undefined,
    ticketUrl: typeof metadata?.ticketUrl === 'string' ? metadata.ticketUrl : undefined,
    expiresAt: paymentTransaction?.expiresAt
      ? new Date(paymentTransaction.expiresAt).toISOString()
      : undefined,
    paymentTransaction,
    message
  }
}

function logSafeOnlinePixPayload(
  onlineOrderId: string,
  paymentStatus: string,
  paymentPreparation: ReturnType<typeof buildPaymentPreparation>
) {
  logger.info(
    {
      orderId: null,
      onlineOrderId,
      transactionId: paymentPreparation.transactionId,
      paymentMethod: paymentPreparation.paymentMethod,
      paymentStatus,
      providerStatus: paymentPreparation.providerStatus,
      qrCode: paymentPreparation.qrCode,
      qrCodeBase64: paymentPreparation.qrCodeBase64,
      ticketUrl: paymentPreparation.ticketUrl,
      expiresAt: paymentPreparation.expiresAt
    },
    'PrepareOnlineCheckoutPaymentService safe PIX payload'
  )
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

    const isPaymentConfirmed =
      onlineOrder.paymentStatus === PaymentStatus.PAID ||
      onlineOrder.paymentStatus === PaymentStatus.NOT_REQUIRED

    if (isPaymentConfirmed) {
      return {
        ...buildPaymentPreparation(
          'paid',
          true,
          null,
          'Pedido ja esta pago'
        ),
        onlineOrder
      }
    }

    if (
      onlineOrder.paymentStatus === PaymentStatus.CANCELLED ||
      onlineOrder.status === OnlineOrderStatus.CANCELLED
    ) {
      return {
        ...buildPaymentPreparation(
          'cancelled',
          false,
          null,
          'Pedido foi cancelado'
        ),
        onlineOrder
      }
    }

    if (paymentMethod !== 'PIX') {
      return {
        ...buildPaymentPreparation(
          'non_payment_method',
          false,
          null,
          `${paymentMethod} sera pago na entrega/retirada`
        ),
        onlineOrder
      }
    }

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
        ...buildPaymentPreparation(
          'pix_unavailable',
          false,
          null,
          'PIX nao esta disponivel. Selecione outro metodo de pagamento.'
        ),
        onlineOrder
      }
    }

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
      const paymentPreparation = buildPaymentPreparation(
        'pix_automatic',
        false,
        existingWaitingTransaction,
        'PIX aguardando pagamento'
      )

      logSafeOnlinePixPayload(
        onlineOrder.id,
        onlineOrder.paymentStatus,
        paymentPreparation
      )

      return {
        ...paymentPreparation,
        onlineOrder
      }
    }

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
      const paymentPreparation = buildPaymentPreparation(
        'pix_automatic',
        false,
        paymentTransaction,
        'PIX criado com sucesso'
      )

      logSafeOnlinePixPayload(
        onlineOrder.id,
        onlineOrder.paymentStatus,
        paymentPreparation
      )

      return {
        ...paymentPreparation,
        onlineOrder
      }
    }

    return {
      ...buildPaymentPreparation(
        'payment_error',
        false,
        paymentTransaction,
        'Nao foi possivel criar pagamento PIX. Tente novamente ou selecione outro metodo.'
      ),
      onlineOrder
    }
  }
}
