import {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'

interface MarkOrderPaymentServiceRequest {
  organizationId: string
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
              orderId: order.id,
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

    io.to(`event:${updatedOrder.eventId}`).emit('order-updated', {
      order: updatedOrder
    })

    return {
      order: updatedOrder
    }
  }
}
