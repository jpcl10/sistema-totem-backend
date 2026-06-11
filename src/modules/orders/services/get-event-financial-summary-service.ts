import { PaymentMethod, PaymentStatus } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface GetEventFinancialSummaryServiceRequest {
  organizationId: string
  eventId: string
}

export class GetEventFinancialSummaryService {
  async execute({
    organizationId,
    eventId
  }: GetEventFinancialSummaryServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const orders = await prisma.order.findMany({
      where: {
        eventId
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        totalInCents: true,
        amountPaidInCents: true,
        createdAt: true,
        paidAt: true
      }
    })

    const totalOrders = orders.length

    const paidOrders = orders.filter(
      (order) => order.paymentStatus === PaymentStatus.PAID
    )

    const pendingOrders = orders.filter(
      (order) => order.paymentStatus === PaymentStatus.PENDING
    )

    const notRequiredOrders = orders.filter(
      (order) => order.paymentStatus === PaymentStatus.NOT_REQUIRED
    )

    const failedOrders = orders.filter(
      (order) => order.paymentStatus === PaymentStatus.FAILED
    )

    const cancelledOrders = orders.filter(
      (order) =>
        order.paymentStatus === PaymentStatus.CANCELLED ||
        order.status === 'CANCELLED'
    )

    const refundedOrders = orders.filter(
      (order) => order.paymentStatus === PaymentStatus.REFUNDED
    )

    const grossTotalInCents = orders
      .filter((order) => order.status !== 'CANCELLED')
      .reduce((sum, order) => sum + order.totalInCents, 0)

    const paidTotalInCents = paidOrders
      .filter((order) => order.status !== 'CANCELLED')
      .reduce((sum, order) => {
        return sum + (order.amountPaidInCents ?? order.totalInCents)
      }, 0)

    const pendingTotalInCents = pendingOrders
      .filter((order) => order.status !== 'CANCELLED')
      .reduce((sum, order) => sum + order.totalInCents, 0)

    const notRequiredTotalInCents = notRequiredOrders
      .filter((order) => order.status !== 'CANCELLED')
      .reduce((sum, order) => sum + order.totalInCents, 0)

    const byPaymentMethod: Record<PaymentMethod, number> = {
      PIX_MANUAL: 0,
      PIX_AUTOMATIC: 0,
      CASH: 0,
      CREDIT_CARD: 0,
      DEBIT_CARD: 0,
      COURTESY: 0,
      OTHER: 0
    }

    for (const order of paidOrders) {
      if (!order.paymentMethod) {
        continue
      }

      byPaymentMethod[order.paymentMethod] +=
        order.amountPaidInCents ?? order.totalInCents
    }

    return {
      summary: {
        event,
        totalOrders,

        paidOrders: paidOrders.length,
        pendingOrders: pendingOrders.length,
        notRequiredOrders: notRequiredOrders.length,
        failedOrders: failedOrders.length,
        cancelledOrders: cancelledOrders.length,
        refundedOrders: refundedOrders.length,

        grossTotalInCents,
        paidTotalInCents,
        pendingTotalInCents,
        notRequiredTotalInCents,

        byPaymentMethod
      }
    }
  }
}