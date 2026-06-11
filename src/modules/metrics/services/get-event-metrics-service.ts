import { prisma } from '../../../lib/prisma.js'

interface GetEventMetricsServiceRequest {
  organizationId: string
  eventId: string
}

export class GetEventMetricsService {
  async execute({
    organizationId,
    eventId
  }: GetEventMetricsServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const orders = await prisma.order.findMany({
      where: {
        eventId
      },
      include: {
        items: {
          include: {
            catalogProduct: {
              include: {
                catalogCategory: true
              }
            }
          }
        }
      }
    })

    const totalOrders = orders.length

    const totalRevenueInCents = orders.reduce(
      (sum, order) => sum + order.totalInCents,
      0
    )

    const averageTicketInCents =
      totalOrders > 0
        ? Math.round(totalRevenueInCents / totalOrders)
        : 0

    const ordersByStatus = orders.reduce<Record<string, number>>(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1
        return acc
      },
      {}
    )

    const salesBySector = {
      BAR: 0,
      KITCHEN: 0
    }

    const productsMap = new Map<
      string,
      {
        productName: string
        quantity: number
        totalInCents: number
      }
    >()

    for (const order of orders) {
      for (const item of order.items) {
        const sector =
          item.catalogProduct?.catalogCategory?.sector

        if (sector === 'BAR' || sector === 'KITCHEN') {
          salesBySector[sector] += item.totalInCents
        }

        const key =
          item.catalogProductId || item.productName

        const current = productsMap.get(key) || {
          productName: item.productName,
          quantity: 0,
          totalInCents: 0
        }

        current.quantity += item.quantity
        current.totalInCents += item.totalInCents

        productsMap.set(key, current)
      }
    }

    const topProducts = Array
      .from(productsMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    return {
      metrics: {
        totalOrders,
        totalRevenueInCents,
        averageTicketInCents,
        ordersByStatus,
        salesBySector,
        topProducts
      }
    }
  }
}