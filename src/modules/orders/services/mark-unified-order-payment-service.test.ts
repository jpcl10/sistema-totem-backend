import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OnlineOrderPaymentMethod,
  PaymentMethod,
  PaymentStatus,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { setSocketServerForTests } from '../../../lib/socket.js'
import { markUnifiedOrderPaymentController } from '../controllers/mark-unified-order-payment-controller.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { MarkOnlineOrderPaymentService } from '../../online-stores/services/mark-online-order-payment-service.js'
import { OrderPrintOrchestratorService } from '../../print-jobs/services/order-print-orchestrator-service.js'
import { MarkUnifiedOrderPaymentService } from './mark-unified-order-payment-service.js'
import { MarkOrderPaymentService } from './mark-order-payment-service.js'

const organizationId = 'org-1'
const otherOrganizationId = 'org-2'
const userId = 'user-1'

function makeEventUnifiedOrder(id: string) {
  return {
    id,
    eventId: 'event-1',
    orderNumber: 10,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    paidAt: new Date('2026-07-16T12:00:00.000Z'),
    totalInCents: 2500,
    createdAt: new Date('2026-07-16T12:00:00.000Z'),
    updatedAt: new Date('2026-07-16T12:00:00.000Z'),
    event: {
      id: 'event-1',
      name: 'Evento',
      organizationId,
      printingEnabled: true
    },
    customer: null,
    device: null,
    items: [],
    printJobs: [{ id: 'print-1', status: 'PENDING' }],
    paymentTransactions: [{ id: 'tx-1' }]
  }
}

function makeOnlineOrder(id: string, paymentStatus: PaymentStatus) {
  return {
    id,
    storeId: 'store-1',
    orderNumber: 20,
    source: 'DIGITAL_MENU',
    fulfillmentType: 'DELIVERY',
    deliveryRuleId: null,
    estimatedMinutes: null,
    customerId: null,
    customerName: 'Cliente',
    customerPhone: '11999999999',
    deliveryAddress: 'Rua A',
    deliveryNumber: '1',
    deliveryNeighborhood: 'Centro',
    deliveryComplement: null,
    deliveryReference: null,
    paymentMethod: OnlineOrderPaymentMethod.CASH,
    paymentStatus,
    paidAt:
      paymentStatus === PaymentStatus.PAID
        ? new Date('2026-07-16T12:00:00.000Z')
        : null,
    changeForInCents: null,
    subtotalInCents: 2000,
    deliveryFeeInCents: 500,
    totalInCents: 2500,
    status: 'RECEIVED',
    notes: null,
    createdAt: new Date('2026-07-16T12:00:00.000Z'),
    updatedAt: new Date('2026-07-16T12:00:00.000Z'),
    store: {
      id: 'store-1',
      slug: 'loja',
      name: 'Loja',
      organizationId,
      printingEnabled: true
    },
    customer: null,
    items: [],
    printJobs: []
  }
}

function installSocketRecorder() {
  const emitted: { room: string; event: string; payload: any }[] = []

  setSocketServerForTests({
    to(room: string) {
      return {
        emit(event: string, payload: any) {
          emitted.push({ room, event, payload })
        }
      }
    }
  } as any)

  return emitted
}

function makeReply() {
  return {
    statusCode: 0,
    payload: null as any,
    status(code: number) {
      this.statusCode = code
      return this
    },
    send(payload: any) {
      this.payload = payload
      return payload
    }
  }
}

function makeControllerRequest(body: any, params: any = {}) {
  return {
    params: {
      orderType: 'ONLINE_ORDER',
      orderId: 'online-order-1',
      ...params
    },
    body,
    user: {
      role: UserRole.ADMIN,
      sub: userId
    },
    tenantContext: {
      organizationId
    }
  } as any
}

test('delegates EVENT_ORDER payment to the native event order service', async () => {
  const originalFindUnique = prisma.order.findUnique
  const originalFindUniqueOrThrow = prisma.order.findUniqueOrThrow
  const originalExecute = MarkOrderPaymentService.prototype.execute
  let delegatedRequest: unknown = null

  ;(prisma.order.findUnique as any) = async () => ({
    id: 'event-order-1',
    event: {
      organizationId
    }
  })
  ;(prisma.order.findUniqueOrThrow as any) = async () =>
    makeEventUnifiedOrder('event-order-1')
  MarkOrderPaymentService.prototype.execute = async function (request: any) {
    delegatedRequest = request
    return { order: { id: request.orderId } as any }
  }

  try {
    const result = await new MarkUnifiedOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderType: 'EVENT_ORDER',
      orderId: 'event-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CASH,
      amountReceivedInCents: 3000,
      changeInCents: 500
    })

    assert.equal(result.order.id, 'event-order-1')
    assert.equal(result.order.nativeId, 'event-order-1')
    assert.equal(result.order.orderType, 'EVENT_ORDER')
    assert.equal(result.order.actionEndpoints.payment, '/orders/unified/EVENT_ORDER/event-order-1/payment')
    assert.deepEqual(delegatedRequest, {
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'event-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CASH,
      amountPaidInCents: 3000,
      changeForInCents: 500
    })
  } finally {
    ;(prisma.order.findUnique as any) = originalFindUnique
    ;(prisma.order.findUniqueOrThrow as any) = originalFindUniqueOrThrow
    MarkOrderPaymentService.prototype.execute = originalExecute
  }
})

test('delegates ONLINE_ORDER payment to the native online order service', async () => {
  const originalExecute = MarkOnlineOrderPaymentService.prototype.execute
  let delegatedRequest: unknown = null

  MarkOnlineOrderPaymentService.prototype.execute = async function (request: any) {
    delegatedRequest = request
    return {
      order: {
        id: request.orderId,
        nativeId: request.orderId,
        orderType: 'ONLINE_ORDER'
      } as any
    }
  }

  try {
    const result = await new MarkUnifiedOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderType: 'ONLINE_ORDER',
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: OnlineOrderPaymentMethod.PIX
    })

    assert.equal(result.order.orderType, 'ONLINE_ORDER')
    assert.deepEqual(delegatedRequest, {
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: OnlineOrderPaymentMethod.PIX,
      amountReceivedInCents: undefined,
      changeInCents: undefined
    })
  } finally {
    MarkOnlineOrderPaymentService.prototype.execute = originalExecute
  }
})

test('returns not found when an OnlineOrder id is sent as EVENT_ORDER', async () => {
  const originalFindUnique = prisma.order.findUnique
  ;(prisma.order.findUnique as any) = async () => null

  try {
    await assert.rejects(
      () => new MarkUnifiedOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderType: 'EVENT_ORDER',
        orderId: 'online-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CASH
      }),
      /Order not found/
    )
  } finally {
    ;(prisma.order.findUnique as any) = originalFindUnique
  }
})

test('returns not found when an Order id is sent as ONLINE_ORDER', async () => {
  const originalExecute = MarkOnlineOrderPaymentService.prototype.execute
  MarkOnlineOrderPaymentService.prototype.execute = async function () {
    throw new Error('Order not found')
  }

  try {
    await assert.rejects(
      () => new MarkUnifiedOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderType: 'ONLINE_ORDER',
        orderId: 'event-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: OnlineOrderPaymentMethod.CASH
      }),
      /Order not found/
    )
  } finally {
    MarkOnlineOrderPaymentService.prototype.execute = originalExecute
  }
})

test('blocks EVENT_ORDER payment from another tenant', async () => {
  const originalFindUnique = prisma.order.findUnique
  ;(prisma.order.findUnique as any) = async () => ({
    id: 'event-order-1',
    event: {
      organizationId: otherOrganizationId
    }
  })

  try {
    await assert.rejects(
      () => new MarkUnifiedOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderType: 'EVENT_ORDER',
        orderId: 'event-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CASH
      }),
      /Access denied/
    )
  } finally {
    ;(prisma.order.findUnique as any) = originalFindUnique
  }
})

test('marks an OnlineOrder from PENDING to PAID without trusting frontend totals', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  const originalFindUniqueOrThrow = prisma.onlineOrder.findUniqueOrThrow
  const originalUpdate = prisma.onlineOrder.update
  const originalPrint = OrderPrintOrchestratorService.prototype.execute
  let updateArgs: any = null
  let printCalls = 0

  ;(prisma.onlineOrder.findUnique as any) = async () => ({
    ...makeOnlineOrder('online-order-1', PaymentStatus.PENDING),
    store: {
      id: 'store-1',
      organizationId
    },
    printJobs: []
  })
  ;(prisma.onlineOrder.update as any) = async (args: any) => {
    updateArgs = args
    return makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  }
  ;(prisma.onlineOrder.findUniqueOrThrow as any) = async () =>
    makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  OrderPrintOrchestratorService.prototype.execute = async function () {
    printCalls += 1
    return { printJobs: [{ id: 'print-1' }] } as any
  }

  try {
    const result = await new MarkOnlineOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: OnlineOrderPaymentMethod.CASH,
      amountReceivedInCents: 3000,
      changeInCents: 500
    })

    assert.equal(result.order.orderType, 'ONLINE_ORDER')
    assert.equal(result.order.payment.status, PaymentStatus.PAID)
    assert.equal(printCalls, 1)
    assert.equal(updateArgs.data.paymentStatus, PaymentStatus.PAID)
    assert.equal(updateArgs.data.paymentMethod, OnlineOrderPaymentMethod.CASH)
    assert.ok(updateArgs.data.paidAt instanceof Date)
    assert.equal('totalInCents' in updateArgs.data, false)
    assert.equal('subtotalInCents' in updateArgs.data, false)
    assert.equal('deliveryFeeInCents' in updateArgs.data, false)
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
    ;(prisma.onlineOrder.findUniqueOrThrow as any) = originalFindUniqueOrThrow
    ;(prisma.onlineOrder.update as any) = originalUpdate
    OrderPrintOrchestratorService.prototype.execute = originalPrint
  }
})

test('keeps OnlineOrder payment confirmation idempotent when already PAID', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  const originalFindUniqueOrThrow = prisma.onlineOrder.findUniqueOrThrow
  const originalUpdate = prisma.onlineOrder.update
  const originalPrint = OrderPrintOrchestratorService.prototype.execute
  let updateCalls = 0
  let printCalls = 0

  ;(prisma.onlineOrder.findUnique as any) = async () => ({
    ...makeOnlineOrder('online-order-1', PaymentStatus.PAID),
    store: {
      id: 'store-1',
      organizationId
    },
    printJobs: [{ id: 'print-1' }]
  })
  ;(prisma.onlineOrder.update as any) = async () => {
    updateCalls += 1
    throw new Error('update should not be called')
  }
  ;(prisma.onlineOrder.findUniqueOrThrow as any) = async () =>
    makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  OrderPrintOrchestratorService.prototype.execute = async function () {
    printCalls += 1
    return { printJobs: [{ id: 'print-1' }] } as any
  }

  try {
    const result = await new MarkOnlineOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.PAID
    })

    assert.equal(result.order.payment.status, PaymentStatus.PAID)
    assert.equal(updateCalls, 0)
    assert.equal(printCalls, 1)
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
    ;(prisma.onlineOrder.findUniqueOrThrow as any) = originalFindUniqueOrThrow
    ;(prisma.onlineOrder.update as any) = originalUpdate
    OrderPrintOrchestratorService.prototype.execute = originalPrint
  }
})

test('blocks OnlineOrder payment from another tenant', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  ;(prisma.onlineOrder.findUnique as any) = async () => ({
    ...makeOnlineOrder('online-order-1', PaymentStatus.PENDING),
    store: {
      id: 'store-1',
      organizationId: otherOrganizationId
    },
    printJobs: []
  })

  try {
    await assert.rejects(
      () => new MarkOnlineOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderId: 'online-order-1',
        paymentStatus: PaymentStatus.PAID
      }),
      /Access denied/
    )
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
  }
})

test('accepts all official EVENT_ORDER payment methods through the unified contract', async () => {
  const originalFindUnique = prisma.order.findUnique
  const originalFindUniqueOrThrow = prisma.order.findUniqueOrThrow
  const originalExecute = MarkOrderPaymentService.prototype.execute
  const delegatedMethods: PaymentMethod[] = []
  const acceptedMethods = [
    PaymentMethod.PIX_MANUAL,
    PaymentMethod.CASH,
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.DEBIT_CARD,
    PaymentMethod.COURTESY,
    PaymentMethod.NFC_BALANCE,
    PaymentMethod.OTHER
  ]

  ;(prisma.order.findUnique as any) = async () => ({
    id: 'event-order-1',
    event: {
      organizationId
    }
  })
  ;(prisma.order.findUniqueOrThrow as any) = async () =>
    makeEventUnifiedOrder('event-order-1')
  MarkOrderPaymentService.prototype.execute = async function (request: any) {
    delegatedMethods.push(request.paymentMethod)
    return { order: { id: request.orderId } as any }
  }

  try {
    for (const method of acceptedMethods) {
      await new MarkUnifiedOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderType: 'EVENT_ORDER',
        orderId: 'event-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: method
      })
    }

    assert.deepEqual(delegatedMethods, acceptedMethods)
  } finally {
    ;(prisma.order.findUnique as any) = originalFindUnique
    ;(prisma.order.findUniqueOrThrow as any) = originalFindUniqueOrThrow
    MarkOrderPaymentService.prototype.execute = originalExecute
  }
})

test('accepts all official ONLINE_ORDER payment methods through the unified contract', async () => {
  const originalExecute = MarkOnlineOrderPaymentService.prototype.execute
  const delegatedMethods: OnlineOrderPaymentMethod[] = []
  const acceptedMethods = [
    OnlineOrderPaymentMethod.PIX,
    OnlineOrderPaymentMethod.CASH,
    OnlineOrderPaymentMethod.CARD_ON_DELIVERY
  ]

  MarkOnlineOrderPaymentService.prototype.execute = async function (request: any) {
    delegatedMethods.push(request.paymentMethod)
    return {
      order: {
        id: request.orderId,
        nativeId: request.orderId,
        orderType: 'ONLINE_ORDER'
      } as any
    }
  }

  try {
    for (const method of acceptedMethods) {
      await new MarkUnifiedOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderType: 'ONLINE_ORDER',
        orderId: 'online-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: method
      })
    }

    assert.deepEqual(delegatedMethods, acceptedMethods)
  } finally {
    MarkOnlineOrderPaymentService.prototype.execute = originalExecute
  }
})

test('rejects payment methods that do not belong to the selected order domain', async () => {
  const originalFindUnique = prisma.order.findUnique

  ;(prisma.order.findUnique as any) = async () => ({
    id: 'event-order-1',
    event: {
      organizationId
    }
  })

  try {
    await assert.rejects(
      () => new MarkUnifiedOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderType: 'EVENT_ORDER',
        orderId: 'event-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: OnlineOrderPaymentMethod.CARD_ON_DELIVERY
      }),
      /Invalid payment method/
    )

    await assert.rejects(
      () => new MarkUnifiedOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderType: 'ONLINE_ORDER',
        orderId: 'online-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CREDIT_CARD
      }),
      /Invalid payment method/
    )
  } finally {
    ;(prisma.order.findUnique as any) = originalFindUnique
  }
})

test('rejects non-PAID transitions on the unified payment confirmation route', async () => {
  await assert.rejects(
    () => new MarkUnifiedOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderType: 'ONLINE_ORDER',
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.FAILED,
      paymentMethod: OnlineOrderPaymentMethod.PIX
    }),
    /Invalid payment status transition/
  )
})

test('validates ONLINE_ORDER cash amount and stores the calculated change', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  const originalFindUniqueOrThrow = prisma.onlineOrder.findUniqueOrThrow
  const originalUpdate = prisma.onlineOrder.update
  const originalPrint = OrderPrintOrchestratorService.prototype.execute
  let updateArgs: any = null

  ;(prisma.onlineOrder.findUnique as any) = async () => ({
    ...makeOnlineOrder('online-order-1', PaymentStatus.PENDING),
    store: {
      id: 'store-1',
      organizationId
    },
    printJobs: []
  })
  ;(prisma.onlineOrder.update as any) = async (args: any) => {
    updateArgs = args
    return makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  }
  ;(prisma.onlineOrder.findUniqueOrThrow as any) = async () =>
    makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  OrderPrintOrchestratorService.prototype.execute = async function () {
    return { printJobs: [{ id: 'print-1' }] } as any
  }

  try {
    await new MarkOnlineOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: OnlineOrderPaymentMethod.CASH,
      amountReceivedInCents: 3000,
      changeInCents: 500
    })

    assert.equal(updateArgs.data.changeForInCents, 500)

    await assert.rejects(
      () => new MarkOnlineOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderId: 'online-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: OnlineOrderPaymentMethod.CASH,
        amountReceivedInCents: 2000,
        changeInCents: 0
      }),
      /Amount received cannot be less than order total/
    )

    await assert.rejects(
      () => new MarkOnlineOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderId: 'online-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: OnlineOrderPaymentMethod.CASH,
        amountReceivedInCents: 3000,
        changeInCents: 400
      }),
      /Change value does not match amount received/
    )
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
    ;(prisma.onlineOrder.findUniqueOrThrow as any) = originalFindUniqueOrThrow
    ;(prisma.onlineOrder.update as any) = originalUpdate
    OrderPrintOrchestratorService.prototype.execute = originalPrint
  }
})

test('does not require amountReceivedInCents for ONLINE_ORDER card or PIX methods', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  const originalFindUniqueOrThrow = prisma.onlineOrder.findUniqueOrThrow
  const originalUpdate = prisma.onlineOrder.update
  const originalPrint = OrderPrintOrchestratorService.prototype.execute
  const updateMethods: OnlineOrderPaymentMethod[] = []

  ;(prisma.onlineOrder.findUnique as any) = async () => ({
    ...makeOnlineOrder('online-order-1', PaymentStatus.PENDING),
    store: {
      id: 'store-1',
      organizationId
    },
    printJobs: []
  })
  ;(prisma.onlineOrder.update as any) = async (args: any) => {
    updateMethods.push(args.data.paymentMethod)
    return makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  }
  ;(prisma.onlineOrder.findUniqueOrThrow as any) = async () =>
    makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  OrderPrintOrchestratorService.prototype.execute = async function () {
    return { printJobs: [{ id: 'print-1' }] } as any
  }

  try {
    await new MarkOnlineOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: OnlineOrderPaymentMethod.PIX
    })

    await new MarkOnlineOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: OnlineOrderPaymentMethod.CARD_ON_DELIVERY
    })

    assert.deepEqual(updateMethods, [
      OnlineOrderPaymentMethod.PIX,
      OnlineOrderPaymentMethod.CARD_ON_DELIVERY
    ])
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
    ;(prisma.onlineOrder.findUniqueOrThrow as any) = originalFindUniqueOrThrow
    ;(prisma.onlineOrder.update as any) = originalUpdate
    OrderPrintOrchestratorService.prototype.execute = originalPrint
  }
})

test('validates EVENT_ORDER cash amount and emits event and unified socket events', async () => {
  const originalFindFirst = prisma.order.findFirst
  const originalFindUnique = prisma.order.findUnique
  const originalTransaction = prisma.$transaction
  const originalPrint = CreatePrintJobsForOrderService.prototype.execute
  const originalAudit = CreateAuditLogService.prototype.execute
  const emitted = installSocketRecorder()
  let updateArgs: any = null
  let printCalls = 0

  ;(prisma.order.findFirst as any) = async () =>
    makeEventUnifiedOrder('event-order-1')
  ;(prisma.order.findUnique as any) = async () =>
    makeEventUnifiedOrder('event-order-1')
  ;(prisma.$transaction as any) = async (callback: any) =>
    callback({
      order: {
        update: async (args: any) => {
          updateArgs = args
          return {
            ...makeEventUnifiedOrder('event-order-1'),
            amountPaidInCents: args.data.amountPaidInCents,
            changeForInCents: args.data.changeForInCents
          }
        }
      },
      paymentTransaction: {
        count: async () => 0,
        create: async () => ({ id: 'tx-1' })
      }
    })
  CreatePrintJobsForOrderService.prototype.execute = async function () {
    printCalls += 1
    return { printJobs: [{ id: 'print-1' }] } as any
  }
  CreateAuditLogService.prototype.execute = async function () {
    return { auditLog: { id: 'audit-1' } } as any
  }

  try {
    await new MarkOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'event-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CASH,
      amountPaidInCents: 3000,
      changeForInCents: 500
    })

    assert.equal(updateArgs.data.amountPaidInCents, 3000)
    assert.equal(updateArgs.data.changeForInCents, 500)
    assert.equal(printCalls, 1)
    assert.ok(
      emitted.some(item =>
        item.room === 'event:event-1' && item.event === 'order-updated'
      )
    )
    assert.ok(
      emitted.some(item =>
        item.room === 'organization:org-1' &&
        item.event === 'unified-order-updated'
      )
    )
  } finally {
    ;(prisma.order.findFirst as any) = originalFindFirst
    ;(prisma.order.findUnique as any) = originalFindUnique
    ;(prisma.$transaction as any) = originalTransaction
    CreatePrintJobsForOrderService.prototype.execute = originalPrint
    CreateAuditLogService.prototype.execute = originalAudit
  }
})

test('rejects invalid EVENT_ORDER cash amount and change values', async () => {
  const originalFindFirst = prisma.order.findFirst

  ;(prisma.order.findFirst as any) = async () =>
    makeEventUnifiedOrder('event-order-1')

  try {
    await assert.rejects(
      () => new MarkOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderId: 'event-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CASH,
        amountPaidInCents: 2000,
        changeForInCents: 0
      }),
      /Amount received cannot be less than order total/
    )

    await assert.rejects(
      () => new MarkOrderPaymentService().execute({
        organizationId,
        userRole: UserRole.ADMIN,
        userId,
        orderId: 'event-order-1',
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.CASH,
        amountPaidInCents: 3000,
        changeForInCents: 400
      }),
      /Change value does not match amount received/
    )
  } finally {
    ;(prisma.order.findFirst as any) = originalFindFirst
  }
})

test('emits ONLINE_ORDER socket events after payment confirmation', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  const originalFindUniqueOrThrow = prisma.onlineOrder.findUniqueOrThrow
  const originalUpdate = prisma.onlineOrder.update
  const originalPrint = OrderPrintOrchestratorService.prototype.execute
  const emitted = installSocketRecorder()

  ;(prisma.onlineOrder.findUnique as any) = async () => ({
    ...makeOnlineOrder('online-order-1', PaymentStatus.PENDING),
    store: {
      id: 'store-1',
      organizationId
    },
    printJobs: []
  })
  ;(prisma.onlineOrder.update as any) = async () =>
    makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  ;(prisma.onlineOrder.findUniqueOrThrow as any) = async () =>
    makeOnlineOrder('online-order-1', PaymentStatus.PAID)
  OrderPrintOrchestratorService.prototype.execute = async function () {
    return { printJobs: [{ id: 'print-1' }] } as any
  }

  try {
    await new MarkOnlineOrderPaymentService().execute({
      organizationId,
      userRole: UserRole.ADMIN,
      userId,
      orderId: 'online-order-1',
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: OnlineOrderPaymentMethod.PIX
    })

    assert.ok(
      emitted.some(item =>
        item.room === 'organization:org-1' &&
        item.event === 'online-order-updated'
      )
    )
    assert.ok(
      emitted.some(item =>
        item.room === 'organization:org-1' &&
        item.event === 'unified-order-updated'
      )
    )
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
    ;(prisma.onlineOrder.findUniqueOrThrow as any) = originalFindUniqueOrThrow
    ;(prisma.onlineOrder.update as any) = originalUpdate
    OrderPrintOrchestratorService.prototype.execute = originalPrint
  }
})

test('maps unified payment controller errors to the official HTTP status codes', async () => {
  const originalExecute = MarkUnifiedOrderPaymentService.prototype.execute
  const cases = [
    ['Order not found', 404, 'ORDER_NOT_FOUND'],
    ['Access denied', 403, 'ORDER_FORBIDDEN'],
    ['Invalid payment method', 400, 'INVALID_PAYMENT_METHOD'],
    ['Invalid payment status transition', 409, 'INVALID_PAYMENT_TRANSITION'],
    [
      'Amount received cannot be less than order total',
      400,
      'INVALID_PAYMENT_AMOUNT'
    ]
  ] as const

  try {
    for (const [message, statusCode, code] of cases) {
      MarkUnifiedOrderPaymentService.prototype.execute = async function () {
        throw new Error(message)
      }
      const reply = makeReply()

      await markUnifiedOrderPaymentController(
        makeControllerRequest({
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: OnlineOrderPaymentMethod.PIX
        }),
        reply as any
      )

      assert.equal(reply.statusCode, statusCode)
      assert.equal(reply.payload.code, code)
    }
  } finally {
    MarkUnifiedOrderPaymentService.prototype.execute = originalExecute
  }
})

test('returns 400 for invalid unified payment payloads before reaching the service', async () => {
  const originalExecute = MarkUnifiedOrderPaymentService.prototype.execute
  let serviceCalls = 0
  MarkUnifiedOrderPaymentService.prototype.execute = async function () {
    serviceCalls += 1
    return { order: {} as any }
  }

  try {
    const reply = makeReply()

    await markUnifiedOrderPaymentController(
      makeControllerRequest({
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: OnlineOrderPaymentMethod.CASH,
        changeInCents: -1
      }),
      reply as any
    )

    assert.equal(reply.statusCode, 400)
    assert.equal(reply.payload.code, 'INVALID_REQUEST')
    assert.equal(serviceCalls, 0)
  } finally {
    MarkUnifiedOrderPaymentService.prototype.execute = originalExecute
  }
})
