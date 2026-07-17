import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OnlineOrderPaymentMethod,
  OrderSource,
  PaymentMethod,
  PaymentStatus,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { FinancialAggregationService } from './financial-aggregation-service.js'

const organizationId = 'org-1'

type MockState = {
  eventPaidTotal: number
  onlinePaidTotal: number
  onlineDeliveryFee: number
  eventPaidCount: number
  onlinePaidCount: number
  pendingEventCount: number
  pendingOnlineCount: number
  cancelledEventCount: number
  cancelledOnlineCount: number
  refundedEventTotal: number
  refundedOnlineTotal: number
  refundedEventCount: number
  refundedOnlineCount: number
  eventPaymentGroups: any[]
  onlinePaymentGroups: any[]
  onlineSourceGroups: any[]
  onlineFulfillmentGroups: any[]
  eventManualTotal: number
  eventTotemTotal: number
  eventDefaultTotal: number
  timeseriesRows: any[]
  settingsTimezone: string | null
}

const defaultState: MockState = {
  eventPaidTotal: 0,
  onlinePaidTotal: 0,
  onlineDeliveryFee: 0,
  eventPaidCount: 0,
  onlinePaidCount: 0,
  pendingEventCount: 0,
  pendingOnlineCount: 0,
  cancelledEventCount: 0,
  cancelledOnlineCount: 0,
  refundedEventTotal: 0,
  refundedOnlineTotal: 0,
  refundedEventCount: 0,
  refundedOnlineCount: 0,
  eventPaymentGroups: [],
  onlinePaymentGroups: [],
  onlineSourceGroups: [],
  onlineFulfillmentGroups: [],
  eventManualTotal: 0,
  eventTotemTotal: 0,
  eventDefaultTotal: 0,
  timeseriesRows: [],
  settingsTimezone: 'America/Sao_Paulo'
}

function installFinancialMocks(state: Partial<MockState> = {}) {
  const current = {
    ...defaultState,
    ...state
  }
  const originals = {
    organizationSettingsFindUnique: prisma.organizationSettings.findUnique,
    eventFindFirst: prisma.event.findFirst,
    onlineStoreFindFirst: prisma.onlineStore.findFirst,
    orderAggregate: prisma.order.aggregate,
    onlineOrderAggregate: prisma.onlineOrder.aggregate,
    orderCount: prisma.order.count,
    onlineOrderCount: prisma.onlineOrder.count,
    orderGroupBy: prisma.order.groupBy,
    onlineOrderGroupBy: prisma.onlineOrder.groupBy,
    queryRaw: prisma.$queryRaw
  }
  const orderAggregateCalls: any[] = []
  const onlineOrderAggregateCalls: any[] = []
  const orderCountCalls: any[] = []
  const onlineOrderCountCalls: any[] = []
  const queryRawCalls: any[] = []

  ;(prisma.organizationSettings.findUnique as any) = async () =>
    current.settingsTimezone
      ? {
          timezone: current.settingsTimezone
        }
      : null
  ;(prisma.event.findFirst as any) = async () => ({
    id: 'event-1',
    name: 'Evento',
    slug: 'evento'
  })
  ;(prisma.onlineStore.findFirst as any) = async () => ({
    id: 'store-1',
    name: 'Loja',
    slug: 'loja'
  })
  ;(prisma.order.aggregate as any) = async (args: any) => {
    orderAggregateCalls.push(args)

    if (args.where.paymentStatus === 'REFUNDED') {
      return { _sum: { totalInCents: current.refundedEventTotal } }
    }

    if (args.where.paymentNotes === 'Venda manual criada pelo painel') {
      return { _sum: { totalInCents: current.eventManualTotal } }
    }

    if (args.where.device?.is?.type === 'TOTEM') {
      return { _sum: { totalInCents: current.eventTotemTotal } }
    }

    if (args.where.OR) {
      return { _sum: { totalInCents: current.eventDefaultTotal } }
    }

    return { _sum: { totalInCents: current.eventPaidTotal } }
  }
  ;(prisma.onlineOrder.aggregate as any) = async (args: any) => {
    onlineOrderAggregateCalls.push(args)

    if (args.where.paymentStatus === 'REFUNDED') {
      return { _sum: { totalInCents: current.refundedOnlineTotal } }
    }

    if (args._sum.deliveryFeeInCents) {
      return { _sum: { deliveryFeeInCents: current.onlineDeliveryFee } }
    }

    return { _sum: { totalInCents: current.onlinePaidTotal } }
  }
  ;(prisma.order.count as any) = async (args: any) => {
    orderCountCalls.push(args)

    if (args.where.paymentStatus === 'PAID') {
      return current.eventPaidCount
    }

    if (args.where.paymentStatus === 'PENDING') {
      return current.pendingEventCount
    }

    if (args.where.paymentStatus === 'REFUNDED') {
      return current.refundedEventCount
    }

    return current.cancelledEventCount
  }
  ;(prisma.onlineOrder.count as any) = async (args: any) => {
    onlineOrderCountCalls.push(args)

    if (args.where.paymentStatus === 'PAID') {
      return current.onlinePaidCount
    }

    if (args.where.paymentStatus === 'PENDING') {
      return current.pendingOnlineCount
    }

    if (args.where.paymentStatus === 'REFUNDED') {
      return current.refundedOnlineCount
    }

    return current.cancelledOnlineCount
  }
  ;(prisma.order.groupBy as any) = async () => current.eventPaymentGroups
  ;(prisma.onlineOrder.groupBy as any) = async (args: any) => {
    if (args.by.includes('paymentMethod')) {
      return current.onlinePaymentGroups
    }

    if (args.by.includes('source')) {
      return current.onlineSourceGroups
    }

    return current.onlineFulfillmentGroups
  }
  ;(prisma.$queryRaw as any) = async (...args: any[]) => {
    queryRawCalls.push(args)
    return current.timeseriesRows
  }

  return {
    orderAggregateCalls,
    onlineOrderAggregateCalls,
    orderCountCalls,
    onlineOrderCountCalls,
    queryRawCalls,
    restore() {
      ;(prisma.organizationSettings.findUnique as any) =
        originals.organizationSettingsFindUnique
      ;(prisma.event.findFirst as any) = originals.eventFindFirst
      ;(prisma.onlineStore.findFirst as any) =
        originals.onlineStoreFindFirst
      ;(prisma.order.aggregate as any) = originals.orderAggregate
      ;(prisma.onlineOrder.aggregate as any) =
        originals.onlineOrderAggregate
      ;(prisma.order.count as any) = originals.orderCount
      ;(prisma.onlineOrder.count as any) = originals.onlineOrderCount
      ;(prisma.order.groupBy as any) = originals.orderGroupBy
      ;(prisma.onlineOrder.groupBy as any) = originals.onlineOrderGroupBy
      ;(prisma.$queryRaw as any) = originals.queryRaw
    }
  }
}

test('aggregates paid event and online orders without trusting amount received or change', async () => {
  const mocks = installFinancialMocks({
    eventPaidTotal: 2500,
    onlinePaidTotal: 3500,
    onlineDeliveryFee: 500,
    eventPaidCount: 1,
    onlinePaidCount: 1,
    pendingEventCount: 1,
    pendingOnlineCount: 2,
    cancelledEventCount: 1,
    cancelledOnlineCount: 1,
    eventPaymentGroups: [
      {
        paymentMethod: PaymentMethod.CASH,
        _sum: { totalInCents: 2500 },
        _count: { _all: 1 }
      }
    ],
    onlinePaymentGroups: [
      {
        paymentMethod: OnlineOrderPaymentMethod.PIX,
        _sum: { totalInCents: 3500 },
        _count: { _all: 1 }
      }
    ],
    onlineSourceGroups: [
      {
        source: OrderSource.DIGITAL_MENU,
        _sum: { totalInCents: 3500 }
      }
    ],
    onlineFulfillmentGroups: [
      {
        fulfillmentType: 'DELIVERY',
        _sum: { totalInCents: 3500 }
      }
    ],
    eventDefaultTotal: 2500,
    timeseriesRows: [
      {
        periodStart: new Date('2026-07-16T03:00:00.000Z'),
        grossRevenueInCents: 0n,
        paidOrdersCount: 0n
      },
      {
        periodStart: new Date('2026-07-16T04:00:00.000Z'),
        grossRevenueInCents: 6000n,
        paidOrdersCount: 2n
      }
    ]
  })

  try {
    const { summary } = await new FinancialAggregationService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      period: 'TODAY',
      now: new Date('2026-07-16T15:00:00.000Z')
    })

    assert.equal(summary.grossRevenueInCents, 6000)
    assert.equal(summary.netRevenueInCents, 6000)
    assert.equal(summary.deliveryFeesInCents, 500)
    assert.equal(summary.discountsInCents, 0)
    assert.equal(summary.paidOrdersCount, 2)
    assert.equal(summary.pendingOrdersCount, 3)
    assert.equal(summary.canceledOrdersCount, 2)
    assert.equal(summary.averageTicketInCents, 3000)
    assert.equal(summary.byPaymentMethod.CASH.amountInCents, 2500)
    assert.equal(summary.byPaymentMethod.PIX.amountInCents, 3500)
    assert.equal(summary.bySource.EVENT, 2500)
    assert.equal(summary.bySource.DIGITAL_MENU, 3500)
    assert.equal(summary.byOrderType.EVENT_ORDER, 2500)
    assert.equal(summary.byOrderType.ONLINE_ORDER, 3500)
    assert.equal(summary.byFulfillmentType.ON_SITE, 2500)
    assert.equal(summary.byFulfillmentType.DELIVERY, 3500)
    assert.equal(summary.timeseries.granularity, 'HOUR')
    assert.equal(summary.timeseries.dateField, 'paidAt')
    assert.equal(summary.timeseries.points.length, 2)
    assert.equal(summary.timeseries.points[0].grossRevenueInCents, 0)
    assert.equal(summary.timeseries.points[0].averageTicketInCents, 0)
    assert.equal(summary.timeseries.points[1].grossRevenueInCents, 6000)
    assert.equal(summary.timeseries.points[1].paidOrdersCount, 2)
    assert.equal(summary.timeseries.points[1].averageTicketInCents, 3000)
  } finally {
    mocks.restore()
  }
})

test('uses paidAt for recognized revenue and timezone day boundaries', async () => {
  const mocks = installFinancialMocks()

  try {
    const { summary } = await new FinancialAggregationService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      period: 'CUSTOM',
      startDate: '2026-07-16',
      endDate: '2026-07-16'
    })

    assert.equal(summary.period.timezone, 'America/Sao_Paulo')
    assert.equal(summary.period.startDate, '2026-07-16T03:00:00.000Z')
    assert.equal(summary.period.endDate, '2026-07-17T02:59:59.999Z')

    const paidOrderAggregate = mocks.orderAggregateCalls.find(call => {
      return call.where.paymentStatus === 'PAID' && !call.where.OR
    })
    const pendingOrderCount = mocks.orderCountCalls.find(call => {
      return call.where.paymentStatus === 'PENDING'
    })

    assert.deepEqual(paidOrderAggregate.where.paidAt, {
      gte: new Date('2026-07-16T03:00:00.000Z'),
      lte: new Date('2026-07-17T02:59:59.999Z')
    })
    assert.deepEqual(pendingOrderCount.where.createdAt, {
      gte: new Date('2026-07-16T03:00:00.000Z'),
      lte: new Date('2026-07-17T02:59:59.999Z')
    })
  } finally {
    mocks.restore()
  }
})

test('filters by tenant-owned store and online source without loading event orders', async () => {
  const mocks = installFinancialMocks({
    onlinePaidTotal: 2000,
    onlinePaidCount: 1
  })

  try {
    const { summary } = await new FinancialAggregationService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      orderType: 'ONLINE_ORDER',
      storeId: 'store-1',
      source: 'MANUAL_STORE',
      period: 'EVENT'
    })

    assert.equal(summary.grossRevenueInCents, 2000)
    assert.equal(mocks.orderAggregateCalls.length, 0)
    assert.ok(
      mocks.onlineOrderAggregateCalls.every(call => {
        return (
          call.where.storeId === 'store-1' &&
          call.where.store.organizationId === organizationId &&
          call.where.source === OrderSource.ADMIN
        )
      })
    )
  } finally {
    mocks.restore()
  }
})

test('uses fallback timezone when organization settings do not exist', async () => {
  const mocks = installFinancialMocks({
    settingsTimezone: null
  })

  try {
    const { summary } = await new FinancialAggregationService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      period: 'TODAY',
      now: new Date('2026-07-16T15:00:00.000Z')
    })

    assert.equal(summary.period.timezone, 'America/Sao_Paulo')
    assert.equal(summary.timeseries.timezone, 'America/Sao_Paulo')
  } finally {
    mocks.restore()
  }
})

test('returns empty financial timeseries when paymentStatus filter excludes PAID', async () => {
  const mocks = installFinancialMocks({
    eventPaidTotal: 5000,
    onlinePaidTotal: 5000,
    timeseriesRows: [
      {
        periodStart: new Date('2026-07-16T03:00:00.000Z'),
        grossRevenueInCents: 10000n,
        paidOrdersCount: 2n
      }
    ]
  })

  try {
    const { summary } = await new FinancialAggregationService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      period: 'TODAY',
      paymentStatus: PaymentStatus.PENDING,
      now: new Date('2026-07-16T15:00:00.000Z')
    })

    assert.equal(summary.grossRevenueInCents, 0)
    assert.equal(summary.paidOrdersCount, 0)
    assert.equal(summary.timeseries.granularity, 'HOUR')
    assert.deepEqual(summary.timeseries.points, [])
    assert.equal(mocks.queryRawCalls.length, 0)
  } finally {
    mocks.restore()
  }
})

test('selects day and month granularity from requested period', async () => {
  const mocks = installFinancialMocks()

  try {
    const sevenDays = await new FinancialAggregationService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      period: 'LAST_7_DAYS',
      now: new Date('2026-07-16T15:00:00.000Z')
    })

    const longCustom = await new FinancialAggregationService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      period: 'CUSTOM',
      startDate: '2026-01-01',
      endDate: '2026-07-16'
    })

    assert.equal(sevenDays.summary.timeseries.granularity, 'DAY')
    assert.equal(longCustom.summary.timeseries.granularity, 'MONTH')
  } finally {
    mocks.restore()
  }
})
