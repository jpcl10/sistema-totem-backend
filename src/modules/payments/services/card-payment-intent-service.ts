import {
  AuditAction,
  OrderSource,
  PaymentContextType,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus
} from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'

export type CardPaymentResult =
  | 'APPROVED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'ERROR'
  | 'PENDING'

interface CreateCardPaymentIntentRequest {
  organizationId: string
  orderId?: string | null
  onlineOrderId?: string | null
  terminalId?: string | null
  method: Extract<PaymentMethod, 'CREDIT_CARD' | 'DEBIT_CARD'>
  provider: PaymentProvider
  amountInCents: number
  installments?: number | null
  idempotencyKey?: string | null
}

interface ConfirmCardPaymentIntentRequest {
  organizationId: string
  deviceId: string
  paymentTransactionId: string
  result: CardPaymentResult
  amountInCents: number
  providerTransactionId?: string | null
  authorizationCode?: string | null
  nsu?: string | null
  brand?: string | null
  installments?: number | null
  gatewayMessage?: string | null
}

interface CreatePublicTotemCardPaymentIntentRequest {
  organizationSlug: string
  eventSlug: string
  orderId: string
}

function isFinalStatus(status: PaymentTransactionStatus) {
  const finalStatuses: PaymentTransactionStatus[] = [
    PaymentTransactionStatus.APPROVED,
    PaymentTransactionStatus.REJECTED,
    PaymentTransactionStatus.CANCELLED,
    PaymentTransactionStatus.ERROR
  ]

  return finalStatuses.includes(status)
}

function mapResult(result: CardPaymentResult) {
  switch (result) {
    case 'APPROVED':
      return PaymentTransactionStatus.APPROVED
    case 'DECLINED':
      return PaymentTransactionStatus.REJECTED
    case 'CANCELLED':
      return PaymentTransactionStatus.CANCELLED
    case 'ERROR':
      return PaymentTransactionStatus.ERROR
    case 'PENDING':
    default:
      return PaymentTransactionStatus.WAITING_PAYMENT
  }
}

export class CardPaymentIntentService {
  async createPublicTotemIntent({
    organizationSlug,
    eventSlug,
    orderId
  }: CreatePublicTotemCardPaymentIntentRequest) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        event: {
          slug: eventSlug,
          organization: {
            slug: organizationSlug
          }
        }
      },
      include: {
        event: {
          select: {
            id: true,
            organizationId: true
          }
        }
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    if (order.source !== OrderSource.TOTEM) {
      throw new Error('Order is not a totem order')
    }

    if (order.paymentMethod !== PaymentMethod.CREDIT_CARD) {
      throw new Error('Order is not configured for card payment')
    }

    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new Error('Order is not pending payment')
    }

    const terminals = await prisma.paymentTerminal.findMany({
      where: {
        organizationId: order.event.organizationId,
        active: true,
        status: 'ACTIVE',
        provider: PaymentProvider.MERCADO_PAGO,
        OR: [
          { eventId: order.eventId },
          {
            eventId: null,
            onlineStoreId: null
          }
        ]
      },
      include: {
        device: {
          select: {
            id: true,
            organizationId: true,
            eventId: true,
            status: true,
            type: true
          }
        }
      }
    })

    if (terminals.length === 0) {
      throw new Error('No active card terminal configured for this totem')
    }

    const eligibleTerminals = terminals.filter(terminal => {
      if (!terminal.deviceId) {
        return false
      }

      return (
        terminal.device?.organizationId === order.event.organizationId &&
        terminal.device.status === 'ACTIVE' &&
        (
          terminal.device.eventId === order.eventId ||
          terminal.device.eventId === null
        )
      )
    })

    if (eligibleTerminals.length === 0) {
      throw new Error('No active device linked to the card terminal')
    }

    if (eligibleTerminals.length > 1) {
      throw new Error('Multiple card terminals are eligible for this totem')
    }

    const terminal = eligibleTerminals[0]
    const idempotencyKey = `totem-card:${order.id}`

    const existing = await prisma.paymentTransaction.findUnique({
      where: {
        idempotencyKey
      }
    })

    if (existing) {
      return {
        paymentTransaction: existing
      }
    }

    const paymentTransaction = await prisma.paymentTransaction.create({
      data: {
        organizationId: order.event.organizationId,
        orderId: order.id,
        terminalId: terminal.id,
        deviceId: terminal.deviceId,
        contextType: PaymentContextType.EVENT,
        eventId: order.eventId,
        provider: terminal.provider,
        status: PaymentTransactionStatus.WAITING_PAYMENT,
        method: PaymentMethod.CREDIT_CARD,
        amountInCents: order.totalInCents,
        idempotencyKey,
        gatewayStatus: 'pending_pinpad_confirmation',
        metadata: {
          source: 'public-totem-card-intent',
          orderId: order.id,
          eventId: order.eventId,
          terminalId: terminal.id,
          deviceId: terminal.deviceId
        }
      }
    })

    await new CreateAuditLogService().execute({
      organizationId: order.event.organizationId,
      eventId: order.eventId,
      deviceId: terminal.deviceId,
      entity: 'PaymentTransaction',
      entityId: paymentTransaction.id,
      action: AuditAction.PAYMENT_CREATED,
      description: 'Intencao publica de pagamento por cartao do totem criada',
      metadata: {
        orderId: order.id,
        paymentTransactionId: paymentTransaction.id,
        amountInCents: order.totalInCents,
        method: PaymentMethod.CREDIT_CARD,
        provider: terminal.provider,
        terminalId: terminal.id,
        deviceId: terminal.deviceId,
        source: OrderSource.TOTEM
      }
    })

    return { paymentTransaction }
  }

  async create({
    organizationId,
    orderId,
    onlineOrderId,
    terminalId,
    method,
    provider,
    amountInCents,
    installments,
    idempotencyKey
  }: CreateCardPaymentIntentRequest) {
    if (!orderId && !onlineOrderId) {
      throw new Error('Order context is required')
    }

    if (orderId && onlineOrderId) {
      throw new Error('Only one order context is allowed')
    }

    if (amountInCents <= 0) {
      throw new Error('Amount must be greater than zero')
    }

    if (idempotencyKey) {
      const existing = await prisma.paymentTransaction.findUnique({
        where: { idempotencyKey }
      })

      if (existing) {
        return { paymentTransaction: existing }
      }
    }

    const order = orderId
      ? await prisma.order.findFirst({
          where: {
            id: orderId,
            event: { organizationId }
          },
          select: {
            id: true,
            eventId: true,
            totalInCents: true
          }
        })
      : null

    const onlineOrder = onlineOrderId
      ? await prisma.onlineOrder.findFirst({
          where: {
            id: onlineOrderId,
            store: { organizationId }
          },
          select: {
            id: true,
            storeId: true,
            totalInCents: true
          }
        })
      : null

    const expectedAmount = order?.totalInCents ?? onlineOrder?.totalInCents

    if (!expectedAmount) {
      throw new Error('Order not found')
    }

    if (expectedAmount !== amountInCents) {
      throw new Error('Payment amount does not match order total')
    }

    if (terminalId) {
      const terminal = await prisma.paymentTerminal.findFirst({
        where: {
          id: terminalId,
          organizationId,
          active: true
        },
        select: { id: true }
      })

      if (!terminal) {
        throw new Error('Payment terminal not found')
      }
    }

    const paymentTransaction = await prisma.paymentTransaction.create({
      data: {
        organizationId,
        orderId: order?.id ?? null,
        onlineOrderId: onlineOrder?.id ?? null,
        terminalId: terminalId ?? null,
        contextType: order
          ? PaymentContextType.EVENT
          : PaymentContextType.ONLINE_STORE,
        eventId: order?.eventId ?? null,
        storeId: onlineOrder?.storeId ?? null,
        provider,
        status: PaymentTransactionStatus.WAITING_PAYMENT,
        method,
        amountInCents,
        installments: installments ?? null,
        idempotencyKey: idempotencyKey ?? null,
        gatewayStatus: 'pending_pinpad_confirmation',
        metadata: {
          source: 'card-payment-intent'
        }
      }
    })

    await new CreateAuditLogService().execute({
      organizationId,
      eventId: order?.eventId,
      entity: 'PaymentTransaction',
      entityId: paymentTransaction.id,
      action: AuditAction.PAYMENT_CREATED,
      description: 'Intenção de pagamento por cartão criada',
      metadata: {
        orderId: order?.id,
        onlineOrderId: onlineOrder?.id,
        amountInCents,
        method,
        provider,
        terminalId
      }
    })

    return { paymentTransaction }
  }

  async confirm({
    organizationId,
    deviceId,
    paymentTransactionId,
    result,
    amountInCents,
    providerTransactionId,
    authorizationCode,
    nsu,
    brand,
    installments,
    gatewayMessage
  }: ConfirmCardPaymentIntentRequest) {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        id: paymentTransactionId,
        organizationId,
        OR: [
          { deviceId },
          { deviceId: null }
        ]
      },
      include: {
        order: true,
        onlineOrder: true,
        terminal: true
      }
    })

    if (!transaction) {
      throw new Error('Payment transaction not found')
    }

    if (transaction.amountInCents !== amountInCents) {
      throw new Error('Payment amount does not match intent amount')
    }

    const nextStatus = mapResult(result)

    if (isFinalStatus(transaction.status)) {
      if (transaction.status === nextStatus) {
        return { paymentTransaction: transaction }
      }

      throw new Error('Payment transaction already confirmed')
    }

    const now = new Date()
    const paymentTransaction = await prisma.$transaction(async tx => {
      const updated = await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          deviceId,
          status: nextStatus,
          providerTransactionId: providerTransactionId ?? null,
          authorizationCode: authorizationCode ?? null,
          nsu: nsu ?? null,
          brand: brand ?? null,
          installments: installments ?? transaction.installments,
          gatewayStatus: result.toLowerCase(),
          gatewayMessage: gatewayMessage ?? null,
          approvedAt:
            nextStatus === PaymentTransactionStatus.APPROVED
              ? now
              : transaction.approvedAt,
          rejectedAt:
            nextStatus === PaymentTransactionStatus.REJECTED
              ? now
              : transaction.rejectedAt,
          cancelledAt:
            nextStatus === PaymentTransactionStatus.CANCELLED
              ? now
              : transaction.cancelledAt,
          errorMessage:
            nextStatus === PaymentTransactionStatus.ERROR
              ? gatewayMessage ?? 'Card payment error'
              : transaction.errorMessage
        }
      })

      if (transaction.orderId) {
        await tx.order.update({
          where: { id: transaction.orderId },
          data: {
            paymentStatus:
              nextStatus === PaymentTransactionStatus.APPROVED
                ? PaymentStatus.PAID
                : nextStatus === PaymentTransactionStatus.WAITING_PAYMENT
                  ? PaymentStatus.PENDING
                  : PaymentStatus.FAILED,
            paymentMethod: transaction.method,
            amountPaidInCents:
              nextStatus === PaymentTransactionStatus.APPROVED
                ? transaction.amountInCents
                : null,
            paidAt:
              nextStatus === PaymentTransactionStatus.APPROVED
                ? now
                : null,
            paymentNotes: gatewayMessage ?? null
          }
        })
      }

      if (transaction.onlineOrderId) {
        await tx.onlineOrder.update({
          where: { id: transaction.onlineOrderId },
          data: {
            paymentStatus:
              nextStatus === PaymentTransactionStatus.APPROVED
                ? PaymentStatus.PAID
                : nextStatus === PaymentTransactionStatus.WAITING_PAYMENT
                  ? PaymentStatus.PENDING
                  : PaymentStatus.FAILED,
            paidAt:
              nextStatus === PaymentTransactionStatus.APPROVED
                ? now
                : null
          }
        })
      }

      return updated
    })

    if (
      nextStatus === PaymentTransactionStatus.APPROVED &&
      transaction.orderId &&
      transaction.order?.paymentStatus !== PaymentStatus.PAID
    ) {
      await new CreatePrintJobsForOrderService().execute({
        orderId: transaction.orderId
      })
    }

    await new CreateAuditLogService().execute({
      organizationId,
      eventId: transaction.eventId,
      deviceId,
      entity: 'PaymentTransaction',
      entityId: transaction.id,
      action:
        nextStatus === PaymentTransactionStatus.APPROVED
          ? AuditAction.PAYMENT_APPROVED
          : nextStatus === PaymentTransactionStatus.REJECTED
            ? AuditAction.PAYMENT_DECLINED
            : nextStatus === PaymentTransactionStatus.CANCELLED
              ? AuditAction.PAYMENT_CANCELLED
              : AuditAction.PAYMENT_REJECTED,
      description: 'Resultado de pagamento por cartão confirmado pelo dispositivo',
      metadata: {
        result,
        amountInCents,
        providerTransactionId,
        authorizationCode,
        nsu,
        brand,
        installments
      }
    })

    return { paymentTransaction }
  }
}
