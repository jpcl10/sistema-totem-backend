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
import { logger } from '../../../lib/logger.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { mapEventOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js'

interface MercadoPagoWebhookServiceRequest {
  body: unknown
  query: unknown
  headers: Record<string, unknown>
}

interface ValidationResult {
  valid: boolean
  reason?: string
}

function validateMercadoPagoSignature(
  headers: Record<string, unknown>,
  paymentId: string
): ValidationResult & { xRequestId?: string } {
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET

  if (!webhookSecret) {
    logger.error('Missing MERCADO_PAGO_WEBHOOK_SECRET')
    return { valid: false, reason: 'webhook_secret_not_configured' }
  }

  const xSignature = headers['x-signature'] as string | undefined
  const xRequestId = headers['x-request-id'] as string | undefined

  if (!xSignature) {
    logger.error('Missing x-signature header')
    return { valid: false, reason: 'missing_x_signature' }
  }

  if (!xRequestId) {
    logger.warn('Missing x-request-id header - proceeding without idempotency check')
  }

  // Extrair ts e v1 do x-signature
  const parts = xSignature.split(',')
  let ts: string | null = null
  let v1: string | null = null

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key === 'ts') ts = value
    if (key === 'v1') v1 = value
  }

  if (!ts) {
    logger.error('Missing ts in x-signature')
    return { valid: false, reason: 'missing_ts' }
  }

  if (!v1) {
    logger.error('Missing v1 in x-signature')
    return { valid: false, reason: 'missing_v1' }
  }

  // Montar manifest
  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`

  // Gerar HMAC SHA256
  const hmac = crypto.createHmac('sha256', webhookSecret)
  hmac.update(manifest)
  const expectedSignature = hmac.digest('hex')

  // Comparar usando timingSafeEqual para evitar ataques de timing
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const receivedBuffer = Buffer.from(v1, 'hex')

  if (expectedBuffer.length !== receivedBuffer.length) {
    logger.error('Invalid signature length')
    return { valid: false, reason: 'invalid_signature' }
  }

  const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer)

  if (!isValid) {
    logger.error('Invalid signature')
    return { valid: false, reason: 'invalid_signature' }
  }

  return { valid: true, xRequestId }
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
    query,
    headers
  }: MercadoPagoWebhookServiceRequest) {
    const paymentId = getPaymentIdFromWebhook(body, query)

    if (!paymentId) {
      return {
        received: true,
        ignored: true,
        reason: 'payment_id_not_found'
      }
    }

    // Validar assinatura antes de qualquer outra coisa
    const validation = validateMercadoPagoSignature(headers, paymentId)
    if (!validation.valid) {
      return {
        received: true,
        ignored: true,
        reason: validation.reason || 'invalid_signature'
      }
    }

    const xRequestId = validation.xRequestId

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

    // Verificar idempotência usando x-request-id
    if (xRequestId && paymentTransaction?.metadata) {
      const metadata = paymentTransaction.metadata as Record<string, unknown>
      const processedWebhookRequestIds = metadata.processedWebhookRequestIds as string[] | undefined
      
      if (processedWebhookRequestIds && processedWebhookRequestIds.includes(xRequestId)) {
        logger.info({ xRequestId, paymentId }, 'Webhook already processed - skipping')
        return {
          received: true,
          ignored: true,
          reason: 'webhook_already_processed',
          paymentId
        }
      }
    }

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
        // Preservar metadata anterior e adicionar processedWebhookRequestIds
        const existingMetadata = paymentTransaction.metadata as Record<string, unknown> || {}
        const existingProcessedIds = Array.isArray(existingMetadata.processedWebhookRequestIds) 
          ? existingMetadata.processedWebhookRequestIds 
          : []
        const updatedProcessedIds = xRequestId 
          ? [...new Set([...existingProcessedIds, xRequestId])] 
          : existingProcessedIds

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
                ...existingMetadata,
                source: 'mercado-pago-webhook',
                mercadoPagoPayment: JSON.parse(
                  JSON.stringify(mercadoPagoPayment)
                ),
                processedWebhookRequestIds: updatedProcessedIds
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

    const unifiedOrder = await prisma.order.findUnique({
      where: {
        id: updatedOrder.id
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            printingEnabled: true
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        device: {
          select: {
            id: true,
            type: true,
            name: true
          }
        },
        items: {
          include: {
            options: true
          }
        },
        printJobs: {
          select: {
            id: true,
            status: true
          }
        },
        paymentTransactions: {
          select: {
            id: true
          }
        }
      }
    })

    if (unifiedOrder) {
      const unifiedPayload = {
        order: mapEventOrderToUnifiedOrder(unifiedOrder)
      }

      io.to(`event:${updatedOrder.eventId}`).emit(
        'unified-order-updated',
        unifiedPayload
      )

      io.to(`organization:${updatedOrder.event.organizationId}`).emit(
        'unified-order-updated',
        unifiedPayload
      )
    }

    return {
      received: true,
      paymentId,
      transactionStatus,
      orderId: updatedOrder.id,
      paymentStatus: updatedOrder.paymentStatus
    }
  }
}
