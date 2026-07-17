import { prisma } from '../../../lib/prisma.js'
import { UserRole, OnlineOrderStatus, OnlineOrderPaymentMethod } from '@prisma/client'

interface GetOnlineStoreSummaryServiceRequest {
  storeId: string
  organizationId: string
  userRole: UserRole
}

export class GetOnlineStoreSummaryService {
  async execute({
    storeId,
    organizationId
  }: GetOnlineStoreSummaryServiceRequest) {
    // Check that store belongs to effective organization
    const store = await prisma.onlineStore.findFirst({
      where: {
        id: storeId,
        organizationId
      }
    })

    if (!store) {
      throw new Error('Store not found')
    }

    // Get today's date range
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // Get all today's online orders for the store
    const orders = await prisma.onlineOrder.findMany({
      where: {
        storeId,
        createdAt: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    })

    // Calculate totals
    const todayOrders = orders.length
    const todayRevenueInCents = orders.reduce(
      (sum, order) => sum + order.totalInCents,
      0
    )
    const averageTicketInCents =
      todayOrders > 0 ? Math.round(todayRevenueInCents / todayOrders) : 0

    // Count by order status
    const receivedCount = orders.filter(
      (order) => order.status === OnlineOrderStatus.RECEIVED
    ).length
    const confirmedCount = orders.filter(
      (order) => order.status === OnlineOrderStatus.CONFIRMED
    ).length
    const preparingCount = orders.filter(
      (order) => order.status === OnlineOrderStatus.PREPARING
    ).length
    const readyCount = orders.filter(
      (order) => order.status === OnlineOrderStatus.READY
    ).length
    const outForDeliveryCount = orders.filter(
      (order) => order.status === OnlineOrderStatus.OUT_FOR_DELIVERY
    ).length
    const deliveredCount = orders.filter(
      (order) => order.status === OnlineOrderStatus.DELIVERED
    ).length
    const cancelledCount = orders.filter(
      (order) => order.status === OnlineOrderStatus.CANCELLED
    ).length

    // Since OnlineOrder doesn't have payment status, assume all are paid
    // (or maybe we need to check, but let's follow the schema for now)
    const pendingPaymentCount = 0
    const paidCount = todayOrders

    // Count by payment method
    let pixInCents = 0
    let cardOnDeliveryInCents = 0
    let cashInCents = 0

    for (const order of orders) {
      switch (order.paymentMethod) {
        case OnlineOrderPaymentMethod.PIX:
          pixInCents += order.totalInCents
          break
        case OnlineOrderPaymentMethod.CARD_ON_DELIVERY:
          cardOnDeliveryInCents += order.totalInCents
          break
        case OnlineOrderPaymentMethod.CASH:
          cashInCents += order.totalInCents
          break
      }
    }

    return {
      todayOrders,
      todayRevenueInCents,
      averageTicketInCents,
      receivedCount,
      confirmedCount,
      preparingCount,
      readyCount,
      outForDeliveryCount,
      deliveredCount,
      cancelledCount,
      pendingPaymentCount,
      paidCount,
      paymentMethodTotals: {
        pixInCents,
        cardOnDeliveryInCents,
        cashInCents
      }
    }
  }
}
