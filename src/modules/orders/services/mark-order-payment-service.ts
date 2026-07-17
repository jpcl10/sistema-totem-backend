import {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus,
  AuditAction,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { mapEventOrderToUnifiedOrder } from '../presenters/unified-order-presenter.js'

interface MarkOrderPaymentServiceRequest {
  organizationId: string
  userRole: UserRole
  userId: string
  orderId: string
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod | null
  amountPaidInCents?: number | null
  changeForInCents?: number | null
  paymentNotes?: string | null
}

export class MarkOrderPaymentService {
  async execute({
    organizationId,
    userId,
    orderId,
    paymentStatus,
    paymentMethod,
    amountPaidInCents,
    changeForInCents,
    paymentNotes
  }: MarkOrderPaymentServiceRequest) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        event: {
          organizationId
        }
      },
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
    })

    if (!order) {
      throw new Error('Order not found')
    }

    if (paymentStatus === PaymentStatus.PAID && !paymentMethod) {
      throw new Error('Payment method is required when payment is paid')
    }

    if (
      paymentStatus === PaymentStatus.PAID &&
      amountPaidInCents !== undefined &&
      amountPaidInCents !== null &&
      amountPaidInCents < 0
    ) {
      throw new Error('Amount paid cannot be negative')
    }

    if (
      changeForInCents !== undefined &&
      changeForInCents !== null &&
      changeForInCents < 0
    ) {
      throw new Error('Change value cannot be negative')
    }

    const shouldMarkAsPaid =
      paymentStatus === PaymentStatus.PAID

    if (
      shouldMarkAsPaid &&
      paymentMethod === PaymentMethod.CASH &&
      amountPaidInCents !== undefined &&
      amountPaidInCents !== null
    ) {
      if (amountPaidInCents < order.totalInCents) {
        throw new Error('Amount received cannot be less than order total')
      }

      const expectedChangeInCents = amountPaidInCents - order.totalInCents

      if (
        changeForInCents !== undefined &&
        changeForInCents !== null &&
        changeForInCents !== expectedChangeInCents
      ) {
        throw new Error('Change value does not match amount received')
      }
    }

    const paidAmount =
      shouldMarkAsPaid
        ? amountPaidInCents ?? order.totalInCents
        : null

    const now = new Date()

    const updatedOrder = await prisma.$transaction(async tx => {
      const updated = await tx.order.update({
        where: {
          id: order.id
        },
        data: {
          paymentStatus,
          paymentMethod: shouldMarkAsPaid
            ? paymentMethod
            : paymentMethod ?? null,
          amountPaidInCents: shouldMarkAsPaid
            ? paidAmount
            : null,
          changeForInCents: shouldMarkAsPaid
            ? changeForInCents ?? null
            : null,
          paidAt: shouldMarkAsPaid
            ? now
            : null,
          paymentNotes: paymentNotes ?? null
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

      if (shouldMarkAsPaid && paidAmount !== null) {
        const existingApprovedTransaction =
          await tx.paymentTransaction.count({
            where: {
              orderId: order.id,
              status: PaymentTransactionStatus.APPROVED
            }
          })

        if (existingApprovedTransaction === 0) {
          await tx.paymentTransaction.create({
            data: {
              organizationId,
              orderId: order.id,
              contextType: 'EVENT',
              eventId: order.eventId,
              provider: PaymentProvider.MANUAL,
              status: PaymentTransactionStatus.APPROVED,
              method: paymentMethod ?? PaymentMethod.OTHER,
              amountInCents: paidAmount,
              gatewayStatus: 'approved',
              gatewayMessage:
                paymentNotes ?? 'Pagamento manual aprovado',
              approvedAt: now,
              metadata: {
                source: 'manual-payment-endpoint'
              }
            }
          })
        }
      }

      return updated
    })

    if (shouldMarkAsPaid) {
      const createPrintJobsForOrderService =
        new CreatePrintJobsForOrderService()

      await createPrintJobsForOrderService.execute({
        orderId: updatedOrder.id
      })
    }

    // Create audit log for payment manual marked
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: updatedOrder.event.organizationId,
      eventId: updatedOrder.eventId,
      userId,
      entity: 'PaymentTransaction',
      action: AuditAction.PAYMENT_MANUAL_MARKED,
      description: 'Pagamento marcado manualmente',
      metadata: {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        paymentStatus,
        paymentMethod,
        amountPaidInCents: paidAmount,
        paymentNotes
      }
    })

    if (io) {
      io.to(`event:${updatedOrder.eventId}`).emit('order-updated', {
        order: updatedOrder
      })
    }

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

      if (io) {
        io.to(`event:${updatedOrder.eventId}`).emit(
          'unified-order-updated',
          unifiedPayload
        )

        io.to(`organization:${organizationId}`).emit(
          'unified-order-updated',
          unifiedPayload
        )
      }
    }

    return {
      order: updatedOrder
    }
  }
}
