import {
  OrderStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentMethod,
  PaymentProvider,
  AuditAction
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

export class ExpirePendingPixPaymentsService {
  async execute() {
    const now = new Date()

    const transactions =
      await prisma.paymentTransaction.findMany({
        where: {
          provider: PaymentProvider.MERCADO_PAGO,
          method: PaymentMethod.PIX_AUTOMATIC,
          expiresAt: {
            lte: now
          },
          status: {
            in: [
              PaymentTransactionStatus.WAITING_PAYMENT,
              PaymentTransactionStatus.CANCELLED
            ]
          },
          order: {
            status: {
              not: OrderStatus.CANCELLED
            },
            paymentStatus: {
              not: PaymentStatus.PAID
            }
          }
        },
        include: {
          order: {
            include: {
              event: true
            }
          }
        }
      })

    for (const transaction of transactions) {
      const updatedOrder =
        await prisma.$transaction(async tx => {
          await tx.paymentTransaction.update({
            where: {
              id: transaction.id
            },
            data: {
              status: PaymentTransactionStatus.EXPIRED,
              expiredAt:
                transaction.expiredAt ?? now,
              gatewayStatus: 'expired',
              gatewayMessage:
                'PIX expirado por tempo limite'
            }
          })

          const order =
            await tx.order.update({
              where: {
                id: transaction.orderId
              },
              data: {
                status: OrderStatus.CANCELLED,
                paymentStatus: PaymentStatus.FAILED,
                cancelReason:
                  'PIX expirado por falta de pagamento',
                cancelledAt: now,
                paymentNotes:
                  'Pagamento PIX expirado automaticamente'
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

          return order
        })

      // Audit: PAYMENT_EXPIRED
      const createAuditLogService = new CreateAuditLogService()
      await createAuditLogService.execute({
        organizationId: updatedOrder.event.organizationId,
        eventId: updatedOrder.eventId,
        entity: 'PaymentTransaction',
        entityId: transaction.id,
        action: AuditAction.PAYMENT_EXPIRED,
        description: 'Pagamento PIX expirado',
        metadata: {
          paymentId: transaction.id,
          orderId: updatedOrder.id,
          expiresAt: transaction.expiresAt?.toISOString()
        }
      })

      // Audit: ORDER_CANCELLED (auto)
      await createAuditLogService.execute({
        organizationId: updatedOrder.event.organizationId,
        eventId: updatedOrder.eventId,
        entity: 'Order',
        entityId: updatedOrder.id,
        action: AuditAction.ORDER_CANCELLED,
        description: 'Pedido cancelado automaticamente por expiração do PIX',
        metadata: {
          orderId: updatedOrder.id,
          motivo: 'PIX expirado por falta de pagamento',
          valor: updatedOrder.totalInCents
        }
      })

      io.to(`event:${updatedOrder.eventId}`).emit(
        'order-updated',
        {
          order: updatedOrder
        }
      )

      io.to(`event:${updatedOrder.eventId}`).emit(
        'payment-expired',
        {
          order: updatedOrder,
          paymentTransactionId: transaction.id
        }
      )
    }

    return {
      success: true,
      expiredCount: transactions.length
    }
  }
}