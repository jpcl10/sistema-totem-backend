import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import {
  DashboardPeriod,
  getPeriodDateFilter
} from '../../../shared/utils/get-period-date-filter.js'

interface GetEventFinancialSummaryServiceRequest {
  organizationId: string
  eventId: string
  period?: DashboardPeriod
  startDate?: string
  endDate?: string
}

export class GetEventFinancialSummaryService {
  async execute({
    organizationId,
    eventId,
    period = 'EVENT',
    startDate,
    endDate
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

    const createdAtFilter = getPeriodDateFilter({
      period,
      startDate,
      endDate
    })

    const orders = await prisma.order.findMany({
      where: {
        eventId,

        ...(createdAtFilter
          ? {
              createdAt: createdAtFilter
            }
          : {})
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
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const totalOrders = orders.length

    const paidOrders = orders.filter(order => {
      return (
        order.paymentStatus === PaymentStatus.PAID &&
        order.status !== OrderStatus.CANCELLED
      )
    })

    const pendingOrders = orders.filter(order => {
      return (
        order.paymentStatus === PaymentStatus.PENDING &&
        order.status !== OrderStatus.CANCELLED
      )
    })

    const notRequiredOrders = orders.filter(order => {
      return (
        order.paymentStatus === PaymentStatus.NOT_REQUIRED &&
        order.status !== OrderStatus.CANCELLED
      )
    })

    const failedOrders = orders.filter(order => {
      return (
        order.paymentStatus === PaymentStatus.FAILED &&
        order.status !== OrderStatus.CANCELLED
      )
    })

    const cancelledOrders = orders.filter(order => {
      return (
        order.status === OrderStatus.CANCELLED ||
        order.paymentStatus === PaymentStatus.CANCELLED
      )
    })

    const refundedOrders = orders.filter(order => {
      return (
        order.paymentStatus === PaymentStatus.REFUNDED
      )
    })

    const grossTotalInCents = orders
      .filter(order => {
        return order.status !== OrderStatus.CANCELLED
      })
      .reduce((sum, order) => {
        return sum + order.totalInCents
      }, 0)

    const paidTotalInCents = paidOrders.reduce(
      (sum, order) => {
        return (
          sum +
          (
            order.amountPaidInCents ??
            order.totalInCents
          )
        )
      },
      0
    )

    const pendingTotalInCents =
      pendingOrders.reduce((sum, order) => {
        return sum + order.totalInCents
      }, 0)

    const notRequiredTotalInCents =
      notRequiredOrders.reduce((sum, order) => {
        return sum + order.totalInCents
      }, 0)

    const cancelledTotalInCents =
      cancelledOrders.reduce((sum, order) => {
        return sum + order.totalInCents
      }, 0)

    const refundedTotalInCents =
      refundedOrders.reduce((sum, order) => {
        return (
          sum +
          (
            order.amountPaidInCents ??
            order.totalInCents
          )
        )
      }, 0)

    const averageTicketInCents =
      paidOrders.length > 0
        ? Math.round(
            paidTotalInCents / paidOrders.length
          )
        : 0

    const byPaymentMethod: Record<
      PaymentMethod,
      number
    > = {
      PIX_MANUAL: 0,
      PIX_AUTOMATIC: 0,
      CASH: 0,
      CREDIT_CARD: 0,
      DEBIT_CARD: 0,
      COURTESY: 0,
      OTHER: 0
    }

    const ordersCountByPaymentMethod: Record<
      PaymentMethod,
      number
    > = {
      PIX_MANUAL: 0,
      PIX_AUTOMATIC: 0,
      CASH: 0,
      CREDIT_CARD: 0,
      DEBIT_CARD: 0,
      COURTESY: 0,
      OTHER: 0
    }

    for (const order of paidOrders) {
      const paymentMethod =
        order.paymentMethod ?? PaymentMethod.OTHER

      const amount =
        order.amountPaidInCents ??
        order.totalInCents

      byPaymentMethod[paymentMethod] += amount

      ordersCountByPaymentMethod[paymentMethod] += 1
    }

    return {
      summary: {
        event,

        period,

        dateRange: createdAtFilter
          ? {
              startDate:
                createdAtFilter.gte.toISOString(),

              endDate:
                createdAtFilter.lte.toISOString()
            }
          : null,

        totalOrders,

        paidOrders: paidOrders.length,
        pendingOrders: pendingOrders.length,

        notRequiredOrders:
          notRequiredOrders.length,

        failedOrders: failedOrders.length,

        cancelledOrders:
          cancelledOrders.length,

        refundedOrders: refundedOrders.length,

        grossTotalInCents,
        paidTotalInCents,
        pendingTotalInCents,
        notRequiredTotalInCents,
        cancelledTotalInCents,
        refundedTotalInCents,
        averageTicketInCents,

        byPaymentMethod,
        ordersCountByPaymentMethod
      }
    }
  }
}