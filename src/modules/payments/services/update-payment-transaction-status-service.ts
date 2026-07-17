import {
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  Prisma
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { mapEventOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js'

interface UpdatePaymentTransactionStatusServiceRequest {
  organizationId: string
  paymentTransactionId: string
  status: PaymentTransactionStatus
  gatewayStatus?: string | null
  gatewayMessage?: string | null
  errorMessage?: string | null
  metadata?: Prisma.InputJsonValue | null
}

export class UpdatePaymentTransactionStatusService {
  async execute({
    organizationId,
    paymentTransactionId,
    status,
    gatewayStatus,
    gatewayMessage,
    errorMessage,
    metadata
  }: UpdatePaymentTransactionStatusServiceRequest) {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        id: paymentTransactionId
      },
      include: {
        order: {
          include: {
            event: true
          }
        }
      }
    })

    if (!transaction) {
      throw new Error('Payment transaction not found')
    }

    if (transaction.order.event.organizationId !== organizationId) {
      throw new Error('Unauthorized')
    }

    const now = new Date()

    const transactionDateFields = {
      ...(status === PaymentTransactionStatus.APPROVED && {
        approvedAt: now
      }),

      ...(status === PaymentTransactionStatus.REJECTED && {
        rejectedAt: now
      }),

      ...(status === PaymentTransactionStatus.CANCELLED && {
        cancelledAt: now
      }),

      ...(status === PaymentTransactionStatus.REFUNDED && {
        refundedAt: now
      }),

      ...(status === PaymentTransactionStatus.EXPIRED && {
        expiredAt: now
      })
    }

    const updatedTransaction = await prisma.$transaction(async tx => {
      const paymentTransaction =
        await tx.paymentTransaction.update({
          where: {
            id: transaction.id
          },
          data: {
            status,
            gatewayStatus: gatewayStatus ?? transaction.gatewayStatus,
            gatewayMessage: gatewayMessage ?? transaction.gatewayMessage,
            errorMessage: errorMessage ?? transaction.errorMessage,
            metadata: metadata ?? transaction.metadata ?? undefined,
            ...transactionDateFields
          }
        })

      if (status === PaymentTransactionStatus.APPROVED) {
        await tx.order.update({
          where: {
            id: transaction.orderId
          },
          data: {
            paymentStatus: PaymentStatus.PAID,
            paymentMethod:
              transaction.method ?? PaymentMethod.OTHER,
            amountPaidInCents: transaction.amountInCents,
            paidAt: now,
            paymentNotes:
              gatewayMessage ??
              transaction.gatewayMessage ??
              'Pagamento aprovado'
          }
        })
      }

      if (
        status === PaymentTransactionStatus.REJECTED ||
        status === PaymentTransactionStatus.ERROR ||
        status === PaymentTransactionStatus.EXPIRED
      ) {
        await tx.order.update({
          where: {
            id: transaction.orderId
          },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            paymentNotes:
              errorMessage ??
              gatewayMessage ??
              'Pagamento não aprovado'
          }
        })
      }

      if (status === PaymentTransactionStatus.CANCELLED) {
        await tx.order.update({
          where: {
            id: transaction.orderId
          },
          data: {
            paymentStatus: PaymentStatus.CANCELLED,
            paymentNotes:
              gatewayMessage ??
              'Pagamento cancelado'
          }
        })
      }

      if (status === PaymentTransactionStatus.REFUNDED) {
        await tx.order.update({
          where: {
            id: transaction.orderId
          },
          data: {
            paymentStatus: PaymentStatus.REFUNDED,
            paymentNotes:
              gatewayMessage ??
              'Pagamento estornado'
          }
        })
      }

      return paymentTransaction
    })

    const updatedOrder = await prisma.order.findUnique({
      where: {
        id: transaction.orderId
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

    if (
        updatedOrder &&
        transaction.order.paymentStatus !== PaymentStatus.PAID &&
      status === PaymentTransactionStatus.APPROVED
     ) {
    const createPrintJobsForOrderService =
    new CreatePrintJobsForOrderService()
    await createPrintJobsForOrderService.execute({
      orderId: updatedOrder.id
    })
  }

    if (updatedOrder) {
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

      io.to(`organization:${organizationId}`).emit('order-updated', {
        order: updatedOrder
      })

      io.to(`organization:${organizationId}`).emit('payment-transaction-updated', {
        paymentTransaction: updatedTransaction
      })

      io.to(`event:${updatedOrder.eventId}`).emit('order-updated', {
        order: updatedOrder
      })

      io.to(`event:${updatedOrder.eventId}`).emit('payment-transaction-updated', {
        paymentTransaction: updatedTransaction
      })

      if (unifiedOrder) {
        const unifiedPayload = {
          order: mapEventOrderToUnifiedOrder(unifiedOrder)
        }

        io.to(`organization:${organizationId}`).emit(
          'unified-order-updated',
          unifiedPayload
        )

        io.to(`event:${updatedOrder.eventId}`).emit(
          'unified-order-updated',
          unifiedPayload
        )
      }
    }

    return {
      paymentTransaction: updatedTransaction,
      order: updatedOrder
    }
  }
}
