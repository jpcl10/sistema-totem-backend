import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  OnlineOrderStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { ListUnifiedOrdersService } from './list-unified-orders-service.js'

const organizationId = 'org-1'

function makeEventOrder(id: string, totalInCents = 1000) {
  return {
    id,
    eventId: 'event-1',
    deviceId: null,
    customerId: null,
    customerName: 'Cliente Evento',
    orderNumber: 1,
    status: OrderStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PAID,
    paymentMethod: PaymentMethod.CREDIT_CARD,
    totalInCents,
    amountPaidInCents: null,
    changeForInCents: null,
    paidAt: new Date('2026-07-16T12:00:00.000Z'),
    paymentNotes: null,
    cancelReason: null,
    cancelledAt: null,
    createdAt: new Date('2026-07-16T11:00:00.000Z'),
    updatedAt: new Date('2026-07-16T12:00:00.000Z'),
    event: {
      id: 'event-1',
      name: 'Evento',
      organizationId,
      printingEnabled: false
    },
    customer: null,
    device: null,
    items: [],
    printJobs: [],
    paymentTransactions: []
  }
}

function makeOnlineOrder(id: string, totalInCents = 2000) {
  return {
    id,
    storeId: 'store-1',
    orderNumber: 2,
    customerId: null,
    customerAddressId: null,
    customerName: 'Cliente Online',
    customerPhone: '11999999999',
    deliveryAddress: 'Rua A',
    deliveryNumber: '1',
    deliveryNeighborhood: 'Centro',
    deliveryComplement: null,
    deliveryReference: null,
    paymentMethod: OnlineOrderPaymentMethod.PIX,
    paymentStatus: PaymentStatus.PAID,
    source: OrderSource.DIGITAL_MENU,
    fulfillmentType: OnlineOrderFulfillmentType.DELIVERY,
    deliveryRuleId: null,
    estimatedMinutes: 45,
    changeForInCents: null,
    subtotalInCents: totalInCents,
    deliveryFeeInCents: 0,
    totalInCents,
    status: OnlineOrderStatus.CONFIRMED,
    notes: null,
    paidAt: new Date('2026-07-16T13:00:00.000Z'),
    createdAt: new Date('2026-07-16T10:00:00.000Z'),
    updatedAt: new Date('2026-07-16T13:00:00.000Z'),
    store: {
      id: 'store-1',
      name: 'Loja',
      slug: 'loja',
      organizationId,
      printingEnabled: false
    },
    customer: null,
    items: [],
    printJobs: []
  }
}

function installPrismaMocks({
  eventOrders = [],
  onlineOrders = [],
  eventTotal = eventOrders.length,
  onlineTotal = onlineOrders.length
}: {
  eventOrders?: any[]
  onlineOrders?: any[]
  eventTotal?: number
  onlineTotal?: number
} = {}) {
  const originals = {
    orderFindMany: prisma.order.findMany,
    onlineOrderFindMany: prisma.onlineOrder.findMany,
    orderCount: prisma.order.count,
    onlineOrderCount: prisma.onlineOrder.count,
    orderGroupBy: prisma.order.groupBy,
    onlineOrderGroupBy: prisma.onlineOrder.groupBy
  }
  const calls = {
    orderFindMany: [] as any[],
    onlineOrderFindMany: [] as any[],
    orderCount: [] as any[],
    onlineOrderCount: [] as any[],
    orderGroupBy: [] as any[],
    onlineOrderGroupBy: [] as any[]
  }

  ;(prisma.order.findMany as any) = async (args: any) => {
    calls.orderFindMany.push(args)
    return eventOrders
  }
  ;(prisma.onlineOrder.findMany as any) = async (args: any) => {
    calls.onlineOrderFindMany.push(args)
    return onlineOrders
  }
  ;(prisma.order.count as any) = async (args: any) => {
    calls.orderCount.push(args)

    if (args.where?.AND || args.where?.device || args.where?.paymentNotes) {
      return 0
    }

    return eventTotal
  }
  ;(prisma.onlineOrder.count as any) = async (args: any) => {
    calls.onlineOrderCount.push(args)
    return onlineTotal
  }
  ;(prisma.order.groupBy as any) = async (args: any) => {
    calls.orderGroupBy.push(args)
    return eventTotal > 0
      ? [
          {
            status: OrderStatus.CONFIRMED,
            _count: {
              _all: eventTotal
            }
          }
        ]
      : []
  }
  ;(prisma.onlineOrder.groupBy as any) = async (args: any) => {
    calls.onlineOrderGroupBy.push(args)
    return onlineTotal > 0
      ? [
          {
            status: OnlineOrderStatus.CONFIRMED,
            _count: {
              _all: onlineTotal
            }
          }
        ]
      : []
  }

  return {
    calls,
    restore() {
      ;(prisma.order.findMany as any) = originals.orderFindMany
      ;(prisma.onlineOrder.findMany as any) = originals.onlineOrderFindMany
      ;(prisma.order.count as any) = originals.orderCount
      ;(prisma.onlineOrder.count as any) = originals.onlineOrderCount
      ;(prisma.order.groupBy as any) = originals.orderGroupBy
      ;(prisma.onlineOrder.groupBy as any) = originals.onlineOrderGroupBy
    }
  }
}

function baseRequest(overrides: Partial<Parameters<ListUnifiedOrdersService['execute']>[0]> = {}) {
  return {
    organizationId,
    dateField: 'createdAt' as const,
    page: 1,
    limit: 50,
    sortBy: 'createdAt' as const,
    sortOrder: 'desc' as const,
    ...overrides
  }
}

test('applies EVENT_ORDER paymentMethod and eventId filters before pagination', async () => {
  const mocks = installPrismaMocks({
    eventOrders: [makeEventOrder('event-order-1')],
    onlineOrders: [],
    eventTotal: 1,
    onlineTotal: 0
  })

  try {
    const result = await new ListUnifiedOrdersService().execute(
      baseRequest({
        orderType: 'EVENT_ORDER',
        eventId: 'event-1',
        paymentMethod: PaymentMethod.CREDIT_CARD,
        page: 1,
        limit: 10
      })
    )

    assert.equal(mocks.calls.onlineOrderFindMany.length, 0)
    assert.equal(mocks.calls.orderFindMany[0].where.eventId, 'event-1')
    assert.equal(
      mocks.calls.orderFindMany[0].where.paymentMethod,
      PaymentMethod.CREDIT_CARD
    )
    assert.equal(
      mocks.calls.orderFindMany[0].where.event.organizationId,
      organizationId
    )
    assert.equal(mocks.calls.orderFindMany[0].take, 10)
    assert.equal(result.pagination.total, 1)
    assert.equal(result.data[0].orderType, 'EVENT_ORDER')
  } finally {
    mocks.restore()
  }
})

test('applies ONLINE_ORDER paymentMethod, paymentStatus, storeId, fulfillmentType and paidAt filters', async () => {
  const mocks = installPrismaMocks({
    onlineOrders: [makeOnlineOrder('online-order-1')],
    eventTotal: 0,
    onlineTotal: 1
  })

  try {
    const result = await new ListUnifiedOrdersService().execute(
      baseRequest({
        orderType: 'ONLINE_ORDER',
        storeId: 'store-1',
        paymentMethod: OnlineOrderPaymentMethod.PIX,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentType: OnlineOrderFulfillmentType.DELIVERY,
        dateField: 'paidAt',
        startDate: '2026-07-16T00:00:00.000Z',
        endDate: '2026-07-16T23:59:59.999Z',
        sortBy: 'paidAt',
        sortOrder: 'asc'
      })
    )

    const where = mocks.calls.onlineOrderFindMany[0].where

    assert.equal(mocks.calls.orderFindMany.length, 0)
    assert.equal(where.storeId, 'store-1')
    assert.equal(where.paymentMethod, OnlineOrderPaymentMethod.PIX)
    assert.equal(where.paymentStatus, PaymentStatus.PAID)
    assert.equal(where.fulfillmentType, OnlineOrderFulfillmentType.DELIVERY)
    assert.deepEqual(where.paidAt, {
      gte: new Date('2026-07-16T00:00:00.000Z'),
      lte: new Date('2026-07-16T23:59:59.999Z')
    })
    assert.equal(where.store.organizationId, organizationId)
    assert.deepEqual(mocks.calls.onlineOrderFindMany[0].orderBy[0], {
      paidAt: 'asc'
    })
    assert.equal(result.pagination.total, 1)
    assert.equal(result.data[0].orderType, 'ONLINE_ORDER')
  } finally {
    mocks.restore()
  }
})

test('maps source filters to native online source before querying', async () => {
  const mocks = installPrismaMocks({
    onlineOrders: [makeOnlineOrder('online-order-1')],
    onlineTotal: 1
  })

  try {
    await new ListUnifiedOrdersService().execute(
      baseRequest({
        source: 'MANUAL_STORE',
        paymentMethod: OnlineOrderPaymentMethod.PIX
      })
    )

    assert.equal(mocks.calls.orderFindMany.length, 0)
    assert.equal(
      mocks.calls.onlineOrderFindMany[0].where.source,
      OrderSource.ADMIN
    )
  } finally {
    mocks.restore()
  }
})

test('keeps pagination total based on filtered native counts and paginates after merge', async () => {
  const mocks = installPrismaMocks({
    eventOrders: [makeEventOrder('event-order-1', 1000)],
    onlineOrders: [makeOnlineOrder('online-order-1', 3000)],
    eventTotal: 1,
    onlineTotal: 1
  })

  try {
    const result = await new ListUnifiedOrdersService().execute(
      baseRequest({
        page: 2,
        limit: 1,
        sortBy: 'totalInCents',
        sortOrder: 'desc'
      })
    )

    assert.equal(mocks.calls.orderFindMany[0].take, 2)
    assert.equal(mocks.calls.onlineOrderFindMany[0].take, 2)
    assert.equal(result.pagination.total, 2)
    assert.equal(result.pagination.totalPages, 2)
    assert.equal(result.data.length, 1)
    assert.equal(result.data[0].orderType, 'EVENT_ORDER')
    assert.equal(result.summary.total, 2)
  } finally {
    mocks.restore()
  }
})

test('returns no results for conflicting orderType and sourceType without querying orders', async () => {
  const mocks = installPrismaMocks()

  try {
    const result = await new ListUnifiedOrdersService().execute(
      baseRequest({
        orderType: 'EVENT_ORDER',
        sourceType: 'ONLINE'
      })
    )

    assert.equal(mocks.calls.orderFindMany.length, 0)
    assert.equal(mocks.calls.onlineOrderFindMany.length, 0)
    assert.equal(result.pagination.total, 0)
    assert.deepEqual(result.data, [])
  } finally {
    mocks.restore()
  }
})

test('returns no results when a paymentMethod only exists in the other domain', async () => {
  const mocks = installPrismaMocks()

  try {
    const result = await new ListUnifiedOrdersService().execute(
      baseRequest({
        orderType: 'EVENT_ORDER',
        paymentMethod: OnlineOrderPaymentMethod.CARD_ON_DELIVERY
      })
    )

    assert.equal(mocks.calls.orderFindMany.length, 0)
    assert.equal(mocks.calls.onlineOrderFindMany.length, 0)
    assert.equal(result.pagination.total, 0)
  } finally {
    mocks.restore()
  }
})
