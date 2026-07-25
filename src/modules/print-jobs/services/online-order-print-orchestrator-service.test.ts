import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CategorySector,
  DeviceStatus,
  DeviceType,
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  OnlineOrderStatus,
  OrderSource,
  PaymentStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'
import { OrderPrintOrchestratorService } from './order-print-orchestrator-service.js'

function baseSettings(overrides: Record<string, unknown> = {}) {
  return {
    printingEnabled: true,
    autoPrintEnabled: true,
    splitBySector: false,
    paperSize: '80mm',
    showLogo: false,
    showPrices: false,
    showQrCode: false,
    showPayment: true,
    showOrderSource: true,
    showOrderNotes: true,
    showItemNotes: true,
    showOptions: true,
    defaultPrinterDeviceId: 'device-general',
    kitchenPrinterDeviceId: 'device-kitchen',
    barPrinterDeviceId: 'device-bar',
    expeditionPrinterDeviceId: null,
    sources: {
      ONLINE_STORE: { enabled: true, autoPrint: true, printMode: 'FULL_ORDER' },
      MANUAL_STORE: { enabled: true, autoPrint: true, printMode: 'FULL_ORDER' },
      EVENT: { enabled: true, autoPrint: true, printMode: 'FULL_ORDER' },
      MANUAL_EVENT: { enabled: true, autoPrint: true, printMode: 'FULL_ORDER' },
      TOTEM: { enabled: true, autoPrint: true, printMode: 'FULL_ORDER' },
      POS: { enabled: true, autoPrint: true, printMode: 'FULL_ORDER' },
      API: { enabled: true, autoPrint: true, printMode: 'FULL_ORDER' },
      WAITER: { enabled: true, autoPrint: true, printMode: 'FULL_ORDER' }
    },
    sectors: {
      COOK: { enabled: true },
      BAR: { enabled: true },
      GENERAL: { enabled: true }
    },
    ...overrides
  }
}

function onlineOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'online-order-1',
    storeId: 'store-1',
    orderNumber: 1234,
    source: OrderSource.DIGITAL_MENU,
    fulfillmentType: OnlineOrderFulfillmentType.DELIVERY,
    customerName: 'Maria',
    customerPhone: '11999999999',
    deliveryAddress: 'Rua X',
    deliveryNumber: '123',
    deliveryNeighborhood: 'Centro',
    deliveryCity: 'Sao Paulo',
    deliveryState: 'SP',
    deliveryPostalCode: '01000-000',
    deliveryComplement: '',
    deliveryReference: 'proximo a praca',
    paymentMethod: OnlineOrderPaymentMethod.PIX,
    paymentStatus: PaymentStatus.PAID,
    changeForInCents: null,
    subtotalInCents: 5000,
    deliveryFeeInCents: 700,
    totalInCents: 5700,
    status: OnlineOrderStatus.RECEIVED,
    notes: 'Sem contato no interfone',
    createdAt: new Date('2026-07-25T12:07:00.000Z'),
    store: {
      id: 'store-1',
      organizationId: 'org-1',
      name: 'Loja Defumar',
      city: 'Sao Paulo'
    },
    customerAddress: null,
    printJobs: [],
    items: [
      {
        productName: 'Torresmo de rolo',
        quantity: 2,
        notes: 'Bem passado',
        catalogProduct: {
          catalogCategory: {
            sector: CategorySector.KITCHEN
          }
        },
        options: [{ groupName: 'Adicional', optionName: 'Queijo extra' }],
        flavors: []
      }
    ],
    ...overrides
  }
}

function installMocks(order: any, settings = baseSettings()) {
  const createdJobs: any[] = []
  const originals = {
    onlineOrderFindFirst: prisma.onlineOrder.findFirst,
    deviceFindMany: prisma.device.findMany,
    eventPrintJobFindUnique: prisma.eventPrintJob.findUnique,
    eventPrintJobCreate: prisma.eventPrintJob.create,
    audit: CreateAuditLogService.prototype.execute,
    settings: SettingsResolverService.prototype.execute
  }

  ;(prisma.onlineOrder.findFirst as any) = async () => order
  ;(prisma.device.findMany as any) = async () => [
    {
      id: 'device-general',
      organizationId: 'org-1',
      status: DeviceStatus.ACTIVE,
      type: DeviceType.PRINT_AGENT,
      metadata: null
    },
    {
      id: 'device-kitchen',
      organizationId: 'org-1',
      status: DeviceStatus.ACTIVE,
      type: DeviceType.PRINT_AGENT,
      metadata: null
    },
    {
      id: 'device-bar',
      organizationId: 'org-1',
      status: DeviceStatus.ACTIVE,
      type: DeviceType.PRINT_AGENT,
      metadata: null
    }
  ]
  ;(prisma.eventPrintJob.findUnique as any) = async () => null
  ;(prisma.eventPrintJob.create as any) = async (args: any) => {
    createdJobs.push(args.data)
    return { id: `print-${createdJobs.length}`, ...args.data }
  }
  ;(CreateAuditLogService.prototype.execute as any) = async () => ({ auditLog: { id: 'audit-1' } })
  ;(SettingsResolverService.prototype.execute as any) = async () => ({
    printing: settings
  })

  return {
    createdJobs,
    restore() {
      ;(prisma.onlineOrder.findFirst as any) = originals.onlineOrderFindFirst
      ;(prisma.device.findMany as any) = originals.deviceFindMany
      ;(prisma.eventPrintJob.findUnique as any) = originals.eventPrintJobFindUnique
      ;(prisma.eventPrintJob.create as any) = originals.eventPrintJobCreate
      CreateAuditLogService.prototype.execute = originals.audit
      SettingsResolverService.prototype.execute = originals.settings
    }
  }
}

test('online delivery creates kitchen production and delivery tickets with full address', async () => {
  const mocks = installMocks(onlineOrder())

  try {
    await new OrderPrintOrchestratorService().execute({
      domain: 'ONLINE_ORDER',
      orderId: 'online-order-1'
    })

    assert.equal(mocks.createdJobs.length, 2)
    const production = mocks.createdJobs.find(job => job.payload.templateType === 'PRODUCTION')
    const delivery = mocks.createdJobs.find(job => job.payload.templateType === 'DELIVERY')
    assert.ok(production)
    assert.ok(delivery)
    assert.equal(production.payload.printerSector, 'KITCHEN')
    assert.equal(delivery.payload.printerSector, 'FULL_ORDER')
    assert.equal(delivery.payload.addressStreet, 'Rua X')
    assert.equal(delivery.payload.addressNumber, '123')
    assert.equal(delivery.payload.addressNeighborhood, 'Centro')
    assert.equal(delivery.payload.city, 'Sao Paulo')
    assert.equal(delivery.payload.state, 'SP')
    assert.equal(delivery.payload.postalCode, '01000-000')
    assert.deepEqual(delivery.payload.formattedDeliveryAddress, [
      'Rua X, 123',
      'Bairro Centro',
      'Referencia: proximo a praca',
      'Sao Paulo/SP',
      'CEP 01000-000'
    ])
    assert.equal(delivery.payload.paymentMethodLabel, 'PIX')
    assert.equal(delivery.payload.totalInCents, 5700)
  } finally {
    mocks.restore()
  }
})

test('online pickup paid order creates production ticket without empty delivery address', async () => {
  const mocks = installMocks(onlineOrder({
    fulfillmentType: OnlineOrderFulfillmentType.PICKUP,
    deliveryAddress: 'Retirada no balcao',
    deliveryNumber: 'S/N',
    deliveryNeighborhood: 'Loja',
    deliveryCity: null,
    deliveryState: null,
    deliveryPostalCode: null
  }))

  try {
    await new OrderPrintOrchestratorService().execute({
      domain: 'ONLINE_ORDER',
      orderId: 'online-order-1'
    })

    assert.equal(mocks.createdJobs.length, 1)
    assert.equal(mocks.createdJobs[0].payload.templateType, 'PRODUCTION')
    assert.equal(mocks.createdJobs[0].payload.deliveryAddress, null)
    assert.deepEqual(mocks.createdJobs[0].payload.formattedDeliveryAddress, ['RETIRADA NO LOCAL'])
  } finally {
    mocks.restore()
  }
})

test('online cash on delivery prints while payment is still pending', async () => {
  const mocks = installMocks(onlineOrder({
    paymentMethod: OnlineOrderPaymentMethod.CASH,
    paymentStatus: PaymentStatus.PENDING,
    changeForInCents: 10000
  }))

  try {
    await new OrderPrintOrchestratorService().execute({
      domain: 'ONLINE_ORDER',
      orderId: 'online-order-1'
    })

    assert.equal(mocks.createdJobs.length, 2)
    assert.equal(mocks.createdJobs[0].payload.paymentStatusLabel, 'Pendente')
    assert.equal(mocks.createdJobs[0].payload.changeForInCents, 10000)
  } finally {
    mocks.restore()
  }
})

test('online pending pix and cancelled orders do not print automatically', async () => {
  for (const order of [
    onlineOrder({ paymentStatus: PaymentStatus.PENDING }),
    onlineOrder({ status: OnlineOrderStatus.CANCELLED })
  ]) {
    const mocks = installMocks(order)
    try {
      await new OrderPrintOrchestratorService().execute({
        domain: 'ONLINE_ORDER',
        orderId: 'online-order-1'
      })

      assert.equal(mocks.createdJobs.length, 0)
    } finally {
      mocks.restore()
    }
  }
})

test('online bar items route to BAR target', async () => {
  const mocks = installMocks(onlineOrder({
    fulfillmentType: OnlineOrderFulfillmentType.PICKUP,
    items: [
      {
        productName: 'Refrigerante',
        quantity: 1,
        notes: null,
        catalogProduct: {
          catalogCategory: {
            sector: CategorySector.BAR
          }
        },
        options: [],
        flavors: []
      }
    ]
  }))

  try {
    await new OrderPrintOrchestratorService().execute({
      domain: 'ONLINE_ORDER',
      orderId: 'online-order-1'
    })

    assert.equal(mocks.createdJobs.length, 1)
    assert.equal(mocks.createdJobs[0].deviceId, 'device-bar')
    assert.equal(mocks.createdJobs[0].payload.printerSector, 'BAR')
  } finally {
    mocks.restore()
  }
})
