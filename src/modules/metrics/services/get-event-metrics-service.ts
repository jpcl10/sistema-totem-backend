import { prisma } from '../../../lib/prisma.js'
import {
  DashboardPeriod,
  getPeriodDateFilter
} from '../../../shared/utils/get-period-date-filter.js'

interface GetEventMetricsServiceRequest {
  organizationId: string
  eventId: string
  period?: DashboardPeriod
  startDate?: string
  endDate?: string
}

export class GetEventMetricsService {
  async execute({
    organizationId,
    eventId,
    period = 'EVENT',
    startDate,
    endDate
  }: GetEventMetricsServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true
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
        event: {
          organizationId
        },
        ...(createdAtFilter
          ? {
              createdAt: createdAtFilter
            }
          : {})
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
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const totalOrders = orders.length

    const totalRevenueInCents = orders.reduce(
      (sum, order) => {
        return sum + order.totalInCents
      },
      0
    )

    const averageTicketInCents =
      totalOrders > 0
        ? Math.round(
            totalRevenueInCents / totalOrders
          )
        : 0

    const ordersByStatus =
      orders.reduce<Record<string, number>>(
        (accumulator, order) => {
          accumulator[order.status] =
            (accumulator[order.status] || 0) + 1

          return accumulator
        },
        {}
      )

    const salesBySector = {
      BAR: 0,
      KITCHEN: 0
    }

    const itemsBySector = {
      BAR: 0,
      KITCHEN: 0
    }

    const productsMap = new Map<
      string,
      {
        productName: string
        quantity: number
        totalInCents: number
        sector: 'BAR' | 'KITCHEN' | null
      }
    >()

    for (const order of orders) {
      for (const item of order.items) {
        const sector =
          item.catalogProduct
            ?.catalogCategory
            ?.sector

        if (
          sector === 'BAR' ||
          sector === 'KITCHEN'
        ) {
          salesBySector[sector] +=
            item.totalInCents

          itemsBySector[sector] +=
            item.quantity
        }

        const key =
          item.catalogProductId ||
          item.productId ||
          item.productName

        const current =
          productsMap.get(key) || {
            productName: item.productName,
            quantity: 0,
            totalInCents: 0,
            sector:
              sector === 'BAR' ||
              sector === 'KITCHEN'
                ? sector
                : null
          }

        current.quantity += item.quantity
        current.totalInCents +=
          item.totalInCents

        if (
          current.sector === null &&
          (
            sector === 'BAR' ||
            sector === 'KITCHEN'
          )
        ) {
          current.sector = sector
        }

        productsMap.set(key, current)
      }
    }

    const topProducts = Array
      .from(productsMap.values())
      .sort((firstProduct, secondProduct) => {
        return (
          secondProduct.quantity -
          firstProduct.quantity
        )
      })
      .slice(0, 10)

    const totalProductsSold =
      orders.reduce((ordersTotal, order) => {
        const orderItemsTotal =
          order.items.reduce(
            (itemsTotal, item) => {
              return itemsTotal + item.quantity
            },
            0
          )

        return ordersTotal + orderItemsTotal
      }, 0)

    return {
      metrics: {
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
        totalProductsSold,
        totalRevenueInCents,
        averageTicketInCents,
        ordersByStatus,
        salesBySector,
        itemsBySector,
        topProducts
      }
    }
  }
}
