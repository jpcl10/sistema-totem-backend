import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus,
  AuditAction
} from '@prisma/client'
import crypto from 'node:crypto'
import {
  MercadoPagoConfig,
  Payment
} from 'mercadopago'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface MercadoPagoWebhookServiceRequest {
  body: unknown
  query: unknown
  headers: Record<string, unknown>
}

function getNestedValue(
  value: unknown,
  path: string[]
): unknown {
  let current = value as Record<string, unknown> | undefined

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return null
    }

    current = current[key] as Record<string, unknown> | undefined
  }

  return current ?? null
}

function getPaymentIdFromWebhook(
  body: unknown,
  query: unknown
): string | null {
  const bodyDataId = getNestedValue(body, ['data', 'id'])
  const bodyId = getNestedValue(body, ['id'])

  const queryDataId = getNestedValue(query, ['data.id'])
  const queryId = getNestedValue(query, ['id'])

  const possibleId =
    bodyDataId ??
    bodyId ??
    queryDataId ??
    queryId

  if (
    possibleId === null ||
    possibleId === undefined
  ) {
    return null
  }

  return String(possibleId)
}

function mapMercadoPagoStatusToTransactionStatus(
  status: string | null | undefined
): PaymentTransactionStatus {
  switch (status) {
    case 'approved':
      return PaymentTransactionStatus.APPROVED

    case 'rejected':
      return PaymentTransactionStatus.REJECTED

    case 'cancelled':
      return PaymentTransactionStatus.CANCELLED

    case 'refunded':
      return PaymentTransactionStatus.REFUNDED

    case 'expired':
      return PaymentTransactionStatus.EXPIRED

    case 'pending':
    case 'in_process':
    default:
      return PaymentTransactionStatus.WAITING_PAYMENT
  }
}

export class MercadoPagoWebhookService {
  async execute({
    body,
    query
  }: MercadoPagoWebhookServiceRequest) {
    const paymentId = getPaymentIdFromWebhook(body, query)

    if (!paymentId) {
      return {
        received: true,
        ignored: true,
        reason: 'payment_id_not_found'
      }
    }

    const paymentTransaction =
      await prisma.paymentTransaction.findFirst({
        where: {
          provider: PaymentProvider.MERCADO_PAGO,
          externalId: paymentId
        },
        include: {
          order: {
            include: {
              event: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  organizationId: true
                }
              },
              items: true
            }
          }
        }
      })

    if (!paymentTransaction) {
      return {
      received: true,
      ignored: true,
      reason: 'payment_transaction_not_found',
      paymentId
    }
  }

    const mercadoPagoSettings =
      await prisma.paymentProviderSettings.findUnique({
        where: {
          organizationId_provider: {
            organizationId:
              paymentTransaction.order.event.organizationId,
            provider: PaymentProvider.MERCADO_PAGO
          }
        }
      })

    if (
      !mercadoPagoSettings?.enabled ||
      !mercadoPagoSettings.accessToken
    ) {
      return {
        received: true,
        ignored: true,
        reason: 'mercado_pago_not_configured',
        paymentId
      }
    }

    const client = new MercadoPagoConfig({
      accessToken: mercadoPagoSettings.accessToken
    })

    const paymentClient = new Payment(client)

    const mercadoPagoPayment =
      await paymentClient.get({
        id: paymentId
      })

    const mercadoPagoStatus =
      mercadoPagoPayment.status ?? null

    const transactionStatus =
      mapMercadoPagoStatusToTransactionStatus(
        mercadoPagoStatus
      )

    const now = new Date()

    const updatedOrder =
      await prisma.$transaction(async tx => {
        const updatedPaymentTransaction =
          await tx.paymentTransaction.update({
            where: {
              id: paymentTransaction.id
            },
            data: {
              status: transactionStatus,
              gatewayStatus: mercadoPagoStatus,
              gatewayMessage:
                mercadoPagoPayment.status_detail ?? null,
              approvedAt:
                transactionStatus === PaymentTransactionStatus.APPROVED
                  ? now
                  : paymentTransaction.approvedAt,
              rejectedAt:
                transactionStatus === PaymentTransactionStatus.REJECTED
                  ? now
                  : paymentTransaction.rejectedAt,
              cancelledAt:
                transactionStatus === PaymentTransactionStatus.CANCELLED
                  ? now
                  : paymentTransaction.cancelledAt,
              refundedAt:
                transactionStatus === PaymentTransactionStatus.REFUNDED
                  ? now
                  : paymentTransaction.refundedAt,
              expiredAt:
                transactionStatus === PaymentTransactionStatus.EXPIRED
                  ? now
                  : paymentTransaction.expiredAt,
              metadata: {
                source: 'mercado-pago-webhook',
                mercadoPagoPayment: JSON.parse(
                  JSON.stringify(mercadoPagoPayment)
                )
              }
            }
          })

        if (
          updatedPaymentTransaction.status !==
          PaymentTransactionStatus.APPROVED
        ) {
          return paymentTransaction.order
        }

        const updated = await tx.order.update({
          where: {
            id: paymentTransaction.orderId
          },
          data: {
            paymentStatus: PaymentStatus.PAID,
            paymentMethod: paymentTransaction.method,
            amountPaidInCents:
              updatedPaymentTransaction.amountInCents,
            paidAt: now,
            paymentNotes:
              'Pagamento aprovado automaticamente pelo Mercado Pago'
          },
          include: {
            items: true,
            event: {
              select: {
                id: true,
                name: true,
                slug: true,
                organizationId: true
              }
            }
          }
        })

        return updated
      })

    const createAuditLogService = new CreateAuditLogService()

    if (updatedOrder.paymentStatus === PaymentStatus.PAID) {
      // Audit: PAYMENT_APPROVED
      await createAuditLogService.execute({
        organizationId: paymentTransaction.order.event.organizationId,
        eventId: paymentTransaction.order.eventId,
        entity: 'PaymentTransaction',
        entityId: paymentTransaction.id,
        action: AuditAction.PAYMENT_APPROVED,
        description: 'Pagamento aprovado via PIX',
        metadata: {
          paymentId: paymentTransaction.id,
          orderId: updatedOrder.id,
          amountInCents: paymentTransaction.amountInCents,
          provider: PaymentProvider.MERCADO_PAGO,
          gatewayStatus: mercadoPagoStatus
        }
      })

      const createPrintJobsForOrderService =
        new CreatePrintJobsForOrderService()

      await createPrintJobsForOrderService.execute({
        orderId: updatedOrder.id
      })
    } else if (transactionStatus === PaymentTransactionStatus.REJECTED) {
      // Audit: PAYMENT_REJECTED
      await createAuditLogService.execute({
        organizationId: paymentTransaction.order.event.organizationId,
        eventId: paymentTransaction.order.eventId,
        entity: 'PaymentTransaction',
        entityId: paymentTransaction.id,
        action: AuditAction.PAYMENT_REJECTED,
        description: 'Pagamento rejeitado',
        metadata: {
          paymentId: paymentTransaction.id,
          orderId: paymentTransaction.orderId,
          amountInCents: paymentTransaction.amountInCents,
          provider: PaymentProvider.MERCADO_PAGO,
          gatewayStatus: mercadoPagoStatus,
          gatewayMessage: mercadoPagoPayment.status_detail
        }
      })
    } else if (transactionStatus === PaymentTransactionStatus.REFUNDED) {
      // Audit: PAYMENT_REFUNDED
      await createAuditLogService.execute({
        organizationId: paymentTransaction.order.event.organizationId,
        eventId: paymentTransaction.order.eventId,
        entity: 'PaymentTransaction',
        entityId: paymentTransaction.id,
        action: AuditAction.PAYMENT_REFUNDED,
        description: 'Pagamento reembolsado',
        metadata: {
          paymentId: paymentTransaction.id,
          orderId: paymentTransaction.orderId,
          amountInCents: paymentTransaction.amountInCents,
          provider: PaymentProvider.MERCADO_PAGO,
          gatewayStatus: mercadoPagoStatus,
          gatewayMessage: mercadoPagoPayment.status_detail
        }
      })
    }

    io.to(`event:${updatedOrder.eventId}`).emit('order-updated', {
      order: updatedOrder
    })

    return {
      received: true,
      paymentId,
      transactionStatus,
      orderId: updatedOrder.id,
      paymentStatus: updatedOrder.paymentStatus
    }
  }
}
