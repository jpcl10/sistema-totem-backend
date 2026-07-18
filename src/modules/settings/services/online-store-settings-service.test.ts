import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SettingsChannel,
  SettingsContextType
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { OnlineStoreSettingsService } from './online-store-settings-service.js'

const organizationId = 'org-availability'
const storeId = 'store-availability'

const baseStore = {
  id: storeId,
  organizationId,
  name: 'Guellos Pizza',
  slug: 'guellos-pizza',
  whatsapp: '5599999999999',
  city: 'Sao Paulo',
  address: null,
  logoUrl: null,
  bannerUrl: null,
  isOpen: true,
  active: true,
  manualOverrideMode: 'AUTO',
  manualOverrideUntil: null,
  manualOverrideReason: null,
  manualOverrideUpdatedAt: null,
  manualOverrideUpdatedByUserId: null,
  printingEnabled: false,
  autoPrintEnabled: false,
  printMode: 'FULL_ORDER',
  printerPaperSize: '80mm',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z')
}

const settings = {
  id: 'settings-1',
  organizationId,
  storeId,
  onlineOrderingEnabled: true,
  digitalMenuEnabled: true,
  deliveryEnabled: true,
  pickupEnabled: true,
  counterEnabled: false,
  dineInEnabled: false,
  allowOrdersOutsideHours: false,
  autoAcceptOrders: false,
  minimumOrderInCents: 0,
  estimatedPreparationMinutes: 30,
  estimatedDeliveryMinutes: 45,
  freeDeliveryAboveInCents: null,
  defaultDeliveryFeeInCents: 0,
  closedMessage: null,
  checkoutNotice: null,
  orderConfirmationMessage: null,
  requireCustomerName: true,
  requireCustomerPhone: true,
  requireDeliveryAddress: true,
  allowCustomerNotes: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z')
}

function weeklyHours(open = '17:00', close = '23:00') {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    id: `hour-${dayOfWeek}`,
    organizationId,
    contextType: SettingsContextType.ONLINE_STORE,
    storeId,
    channel: SettingsChannel.ALL,
    dayOfWeek,
    periodIndex: 0,
    opensAt: open,
    closesAt: close,
    isClosed: false,
    is24Hours: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z')
  }))
}

function installMocks({
  store = {},
  hours = weeklyHours(),
  exceptions = []
}: {
  store?: Record<string, unknown>
  hours?: unknown[]
  exceptions?: unknown[]
} = {}) {
  const currentStore = {
    ...baseStore,
    ...store
  }

  const originals = {
    onlineStoreFindFirst: prisma.onlineStore.findFirst,
    onlineStoreUpdate: prisma.onlineStore.update,
    onlineStoreSettingsFindUnique: prisma.onlineStoreSettings.findUnique,
    organizationSettingsFindUnique: prisma.organizationSettings.findUnique,
    businessHourFindMany: prisma.businessHour.findMany,
    businessHourExceptionFindMany: prisma.businessHourException.findMany,
    deliveryFeeRuleFindMany: prisma.deliveryFeeRule.findMany
  }

  const calls = {
    onlineStoreUpdates: [] as unknown[]
  }

  prisma.onlineStore.findFirst = (async () => currentStore) as any
  prisma.onlineStore.update = (async (args: unknown) => {
    calls.onlineStoreUpdates.push(args)
    return {
      ...currentStore,
      ...((args as { data?: Record<string, unknown> }).data ?? {})
    }
  }) as any
  prisma.onlineStoreSettings.findUnique = (async () => settings) as any
  prisma.organizationSettings.findUnique = (async () => ({
    timezone: 'America/Sao_Paulo'
  })) as any
  prisma.businessHour.findMany = (async (args: { where?: { storeId?: string | null } }) =>
    args.where?.storeId === storeId ? hours : []) as any
  prisma.businessHourException.findMany = (async () => exceptions) as any
  prisma.deliveryFeeRule.findMany = (async () => []) as any

  return {
    calls,
    restore() {
      prisma.onlineStore.findFirst = originals.onlineStoreFindFirst
      prisma.onlineStore.update = originals.onlineStoreUpdate
      prisma.onlineStoreSettings.findUnique = originals.onlineStoreSettingsFindUnique
      prisma.organizationSettings.findUnique = originals.organizationSettingsFindUnique
      prisma.businessHour.findMany = originals.businessHourFindMany
      prisma.businessHourException.findMany = originals.businessHourExceptionFindMany
      prisma.deliveryFeeRule.findMany = originals.deliveryFeeRuleFindMany
    }
  }
}

async function resolveAt(date: string) {
  return new OnlineStoreSettingsService().resolveOperation({
    organizationId,
    storeId,
    channel: SettingsChannel.DIGITAL_MENU,
    date: new Date(date)
  })
}

test('closes before configured business hours in America/Sao_Paulo', async () => {
  const mock = installMocks()
  try {
    const result = await resolveAt('2026-07-18T19:00:00.000Z')
    assert.equal(result.availability.isWithinBusinessHours, false)
    assert.equal(result.availability.isOpen, false)
    assert.equal(result.availability.acceptingOrders, false)
    assert.equal(result.availability.reason, 'OUTSIDE_BUSINESS_HOURS')
    assert.equal(result.availability.nextOpeningAt, '2026-07-18T20:00:00.000Z')
  } finally {
    mock.restore()
  }
})

test('opens inside configured business hours', async () => {
  const mock = installMocks()
  try {
    const result = await resolveAt('2026-07-18T21:00:00.000Z')
    assert.equal(result.availability.isWithinBusinessHours, true)
    assert.equal(result.availability.isOpen, true)
    assert.equal(result.availability.acceptingOrders, true)
    assert.equal(result.availability.nextClosingAt, '2026-07-19T02:00:00.000Z')
  } finally {
    mock.restore()
  }
})

test('keeps overnight schedule open after midnight', async () => {
  const mock = installMocks({ hours: weeklyHours('18:00', '02:00') })
  try {
    const result = await resolveAt('2026-07-19T04:00:00.000Z')
    assert.equal(result.availability.isWithinBusinessHours, true)
    assert.equal(result.availability.isOpen, true)
    assert.equal(result.availability.nextClosingAt, '2026-07-19T05:00:00.000Z')
  } finally {
    mock.restore()
  }
})

test('FORCE_OPEN accepts orders outside schedule when the store is active', async () => {
  const mock = installMocks({
    store: {
      manualOverrideMode: 'FORCE_OPEN'
    }
  })
  try {
    const result = await resolveAt('2026-07-18T19:00:00.000Z')
    assert.equal(result.availability.manualOverride, 'FORCE_OPEN')
    assert.equal(result.availability.isOpen, true)
    assert.equal(result.availability.acceptingOrders, true)
  } finally {
    mock.restore()
  }
})

test('FORCE_CLOSED blocks orders inside schedule', async () => {
  const mock = installMocks({
    store: {
      manualOverrideMode: 'FORCE_CLOSED'
    }
  })
  try {
    const result = await resolveAt('2026-07-18T21:00:00.000Z')
    assert.equal(result.availability.manualOverride, 'FORCE_CLOSED')
    assert.equal(result.availability.isOpen, false)
    assert.equal(result.availability.acceptingOrders, false)
    assert.equal(result.availability.reason, 'MANUALLY_CLOSED')
  } finally {
    mock.restore()
  }
})

test('inactive store never accepts orders', async () => {
  const mock = installMocks({
    store: {
      active: false
    }
  })
  try {
    const result = await resolveAt('2026-07-18T21:00:00.000Z')
    assert.equal(result.availability.isActive, false)
    assert.equal(result.availability.isOpen, false)
    assert.equal(result.availability.acceptingOrders, false)
    assert.equal(result.availability.reason, 'STORE_INACTIVE')
  } finally {
    mock.restore()
  }
})

test('expired manual override is resolved and persisted back to AUTO', async () => {
  const mock = installMocks({
    store: {
      manualOverrideMode: 'FORCE_CLOSED',
      manualOverrideUntil: new Date('2026-07-18T20:30:00.000Z')
    }
  })
  try {
    const result = await resolveAt('2026-07-18T21:00:00.000Z')
    assert.equal(result.availability.manualOverride, 'AUTO')
    assert.equal(result.availability.isOpen, true)
    assert.equal(mock.calls.onlineStoreUpdates.length, 1)
  } finally {
    mock.restore()
  }
})
