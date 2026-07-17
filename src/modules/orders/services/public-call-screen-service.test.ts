import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OnlineOrderFulfillmentType,
  OnlineOrderStatus,
  OrderStatus,
  PaymentStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'
import { PublicCallScreenService } from './public-call-screen-service.js'

const organizationId = 'org-1'

function effectiveSettings() {
  return {
    branding: {
      logoUrl: { value: 'https://cdn/logo.png' },
      primaryColor: { value: '#111111' },
      secondaryColor: { value: '#eeeeee' },
      backgroundColor: { value: '#ffffff' },
      bannerUrl: { value: null },
      bannerMobileUrl: { value: null },
      faviconUrl: { value: null },
      theme: { value: 'LIGHT' }
    }
  }
}

function installMocks({
  storeOrders = [],
  eventOrders = [],
  store = {
    id: 'store-1',
    organizationId,
    slug: 'guellos-pizza',
    name: "Guello's Pizza",
    logoUrl: null,
    bannerUrl: null
  },
  event = {
    id: 'event-1',
    organizationId,
    slug: 'evento',
    name: 'Evento',
    logoUrl: null,
    bannerUrl: null,
    primaryColor: null,
    secondaryColor: null,
    totemTextColor: null,
    totemBackgroundColor: null
  }
}: {
  storeOrders?: any[]
  eventOrders?: any[]
  store?: any
  event?: any
} = {}) {
  const originals = {
    onlineStoreFindFirst: prisma.onlineStore.findFirst,
    eventFindFirst: prisma.event.findFirst,
    onlineOrderFindMany: prisma.onlineOrder.findMany,
    orderFindMany: prisma.order.findMany,
    settingsExecute: SettingsResolverService.prototype.execute
  }
  const calls = {
    onlineOrderFindMany: [] as any[],
    orderFindMany: [] as any[]
  }

  ;(prisma.onlineStore.findFirst as any) = async () => store
  ;(prisma.event.findFirst as any) = async () => event
  ;(prisma.onlineOrder.findMany as any) = async (args: any) => {
    calls.onlineOrderFindMany.push(args)
    return storeOrders
  }
  ;(prisma.order.findMany as any) = async (args: any) => {
    calls.orderFindMany.push(args)
    return eventOrders
  }
  SettingsResolverService.prototype.execute = async function () {
    return effectiveSettings() as any
  }

  return {
    calls,
    restore() {
      ;(prisma.onlineStore.findFirst as any) = originals.onlineStoreFindFirst
      ;(prisma.event.findFirst as any) = originals.eventFindFirst
      ;(prisma.onlineOrder.findMany as any) = originals.onlineOrderFindMany
      ;(prisma.order.findMany as any) = originals.orderFindMany
      SettingsResolverService.prototype.execute = originals.settingsExecute
    }
  }
}

function onlineOrder(overrides: Partial<any> = {}) {
  return {
    orderNumber: 12,
    customerName: 'Joao Pedro Cliente',
    status: OnlineOrderStatus.PREPARING,
    fulfillmentType: OnlineOrderFulfillmentType.PICKUP,
    updatedAt: new Date('2026-07-16T12:00:00.000Z'),
    customerPhone: '15999999999',
    deliveryAddress: 'Rua Secreta',
    totalInCents: 9999,
    paymentMethod: 'PIX',
    notes: 'interno',
    customerId: 'customer-1',
    ...overrides
  }
}

function eventOrder(overrides: Partial<any> = {}) {
  return {
    orderNumber: 5,
    customerName: 'Maria Silva',
    status: OrderStatus.READY,
    paymentStatus: PaymentStatus.PAID,
    updatedAt: new Date('2026-07-16T13:00:00.000Z'),
    totalInCents: 1000,
    paymentMethod: 'CASH',
    notes: 'interno',
    customerId: 'customer-2',
    ...overrides
  }
}

test('returns safe STORE call screen bootstrap for pickup and counter orders only', async () => {
  const mocks = installMocks({
    storeOrders: [
      onlineOrder({
        orderNumber: 1,
        status: OnlineOrderStatus.PREPARING,
        fulfillmentType: OnlineOrderFulfillmentType.PICKUP
      }),
      onlineOrder({
        orderNumber: 2,
        status: OnlineOrderStatus.READY,
        fulfillmentType: OnlineOrderFulfillmentType.COUNTER
      })
    ]
  })

  try {
    const result = await new PublicCallScreenService().getBootstrap({
      contextType: 'STORE',
      slug: 'guellos-pizza'
    })

    assert.equal(result.context.type, 'STORE')
    assert.equal(result.orders.preparing[0].publicCode, '#1')
    assert.equal(result.orders.preparing[0].displayName, 'Joao')
    assert.equal(result.orders.ready[0].status, 'READY')
    assert.equal(result.orders.ready[0].fulfillmentType, 'COUNTER')
    assert.deepEqual(
      mocks.calls.onlineOrderFindMany[0].where.fulfillmentType.in,
      [
        OnlineOrderFulfillmentType.PICKUP,
        OnlineOrderFulfillmentType.COUNTER,
        OnlineOrderFulfillmentType.DINE_IN
      ]
    )

    const payload = JSON.stringify(result)
    assert.equal(payload.includes('customerPhone'), false)
    assert.equal(payload.includes('deliveryAddress'), false)
    assert.equal(payload.includes('totalInCents'), false)
    assert.equal(payload.includes('paymentMethod'), false)
    assert.equal(payload.includes('customerId'), false)
    assert.equal(payload.includes('notes'), false)
  } finally {
    mocks.restore()
  }
})

test('STORE query excludes delivery, completed and cancelled statuses at the database layer', async () => {
  const mocks = installMocks()

  try {
    await new PublicCallScreenService().getOrders({
      contextType: 'STORE',
      slug: 'guellos-pizza'
    })

    const where = mocks.calls.onlineOrderFindMany[0].where

    assert.equal(where.storeId, 'store-1')
    assert.equal(where.store.organizationId, organizationId)
    assert.equal(
      where.fulfillmentType.in.includes(OnlineOrderFulfillmentType.DELIVERY),
      false
    )
    assert.equal(where.status.in.includes(OnlineOrderStatus.DELIVERED), false)
    assert.equal(where.status.in.includes(OnlineOrderStatus.CANCELLED), false)
  } finally {
    mocks.restore()
  }
})

test('returns safe EVENT call screen orders and filters by event tenant context', async () => {
  const mocks = installMocks({
    eventOrders: [
      eventOrder({
        orderNumber: 7,
        status: OrderStatus.READY
      }),
      eventOrder({
        orderNumber: 8,
        status: OrderStatus.PREPARING
      })
    ]
  })

  try {
    const result = await new PublicCallScreenService().getBootstrap({
      contextType: 'EVENT',
      slug: 'evento'
    })

    assert.equal(result.context.type, 'EVENT')
    assert.equal(result.orders.ready[0].publicCode, '#7')
    assert.equal(result.orders.ready[0].fulfillmentType, 'EVENT')
    assert.equal(result.orders.ready[0].displayName, 'Maria')
    assert.equal(mocks.calls.orderFindMany[0].where.eventId, 'event-1')
    assert.equal(
      mocks.calls.orderFindMany[0].where.event.organizationId,
      organizationId
    )

    const payload = JSON.stringify(result)
    assert.equal(payload.includes('totalInCents'), false)
    assert.equal(payload.includes('paymentMethod'), false)
    assert.equal(payload.includes('customerId'), false)
    assert.equal(payload.includes('notes'), false)
  } finally {
    mocks.restore()
  }
})

test('throws not found for inactive or missing contexts', async () => {
  const mocks = installMocks({
    store: null,
    event: null
  })

  try {
    await assert.rejects(
      () => new PublicCallScreenService().getBootstrap({
        contextType: 'STORE',
        slug: 'missing'
      }),
      /Call screen context not found/
    )

    await assert.rejects(
      () => new PublicCallScreenService().getBootstrap({
        contextType: 'EVENT',
        slug: 'missing'
      }),
      /Call screen context not found/
    )
  } finally {
    mocks.restore()
  }
})
