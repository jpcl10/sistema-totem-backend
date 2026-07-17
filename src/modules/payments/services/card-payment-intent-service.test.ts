import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PaymentContextType,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CardPaymentIntentService } from './card-payment-intent-service.js'

const organizationId = 'org-1'

function installPrismaMocks(overrides: {
  orderFindFirst?: (args: any) => Promise<any>
  onlineOrderFindFirst?: (args: any) => Promise<any>
  paymentTerminalFindFirst?: (args: any) => Promise<any>
  paymentTransactionFindUnique?: (args: any) => Promise<any>
  paymentTransactionFindFirst?: (args: any) => Promise<any>
  paymentTransactionCreate?: (args: any) => Promise<any>
  transaction?: (callback: any) => Promise<any>
}) {
  const originals = {
    orderFindFirst: prisma.order.findFirst,
    onlineOrderFindFirst: prisma.onlineOrder.findFirst,
    paymentTerminalFindFirst: prisma.paymentTerminal.findFirst,
    paymentTransactionFindUnique: prisma.paymentTransaction.findUnique,
    paymentTransactionFindFirst: prisma.paymentTransaction.findFirst,
    paymentTransactionCreate: prisma.paymentTransaction.create,
    transaction: prisma.$transaction
  }

  ;(prisma.order.findFirst as any) =
    overrides.orderFindFirst ?? (async () => null)
  ;(prisma.onlineOrder.findFirst as any) =
    overrides.onlineOrderFindFirst ?? (async () => null)
  ;(prisma.paymentTerminal.findFirst as any) =
    overrides.paymentTerminalFindFirst ?? (async () => null)
  ;(prisma.paymentTransaction.findUnique as any) =
    overrides.paymentTransactionFindUnique ?? (async () => null)
  ;(prisma.paymentTransaction.findFirst as any) =
    overrides.paymentTransactionFindFirst ?? (async () => null)
  ;(prisma.paymentTransaction.create as any) =
    overrides.paymentTransactionCreate ?? (async () => null)
  ;(prisma.$transaction as any) =
    overrides.transaction ?? (async (callback: any) => callback(prisma))

  return () => {
    ;(prisma.order.findFirst as any) = originals.orderFindFirst
    ;(prisma.onlineOrder.findFirst as any) = originals.onlineOrderFindFirst
    ;(prisma.paymentTerminal.findFirst as any) =
      originals.paymentTerminalFindFirst
    ;(prisma.paymentTransaction.findUnique as any) =
      originals.paymentTransactionFindUnique
    ;(prisma.paymentTransaction.findFirst as any) =
      originals.paymentTransactionFindFirst
    ;(prisma.paymentTransaction.create as any) =
      originals.paymentTransactionCreate
    ;(prisma.$transaction as any) = originals.transaction
  }
}

function baseTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    organizationId,
    orderId: 'order-1',
    onlineOrderId: null,
    terminalId: null,
    deviceId: null,
    eventId: 'event-1',
    storeId: null,
    provider: PaymentProvider.STONE,
    status: PaymentTransactionStatus.WAITING_PAYMENT,
    method: PaymentMethod.CREDIT_CARD,
    amountInCents: 1000,
    installments: 1,
    approvedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    errorMessage: null,
    order: {
      id: 'order-1',
      paymentStatus: PaymentStatus.PENDING
    },
    onlineOrder: null,
    terminal: null,
    contextType: PaymentContextType.EVENT,
    ...overrides
  }
}

test('card intent rejects divergent amount', async () => {
  const restore = installPrismaMocks({
    orderFindFirst: async () => ({
      id: 'order-1',
      eventId: 'event-1',
      totalInCents: 1000
    })
  })

  try {
    await assert.rejects(
      () => new CardPaymentIntentService().create({
        organizationId,
        orderId: 'order-1',
        method: PaymentMethod.CREDIT_CARD,
        provider: PaymentProvider.STONE,
        amountInCents: 999
      }),
      /does not match order total/
    )
  } finally {
    restore()
  }
})

test('card intent rejects terminal outside organization', async () => {
  const restore = installPrismaMocks({
    orderFindFirst: async () => ({
      id: 'order-1',
      eventId: 'event-1',
      totalInCents: 1000
    }),
    paymentTerminalFindFirst: async () => null
  })

  try {
    await assert.rejects(
      () => new CardPaymentIntentService().create({
        organizationId,
        orderId: 'order-1',
        terminalId: 'terminal-other-org',
        method: PaymentMethod.DEBIT_CARD,
        provider: PaymentProvider.STONE,
        amountInCents: 1000
      }),
      /Payment terminal not found/
    )
  } finally {
    restore()
  }
})

test('card confirmation rejects divergent amount', async () => {
  const restore = installPrismaMocks({
    paymentTransactionFindFirst: async () => baseTransaction()
  })

  try {
    await assert.rejects(
      () => new CardPaymentIntentService().confirm({
        organizationId,
        deviceId: 'device-1',
        paymentTransactionId: 'payment-1',
        result: 'APPROVED',
        amountInCents: 999
      }),
      /does not match intent amount/
    )
  } finally {
    restore()
  }
})

test('card confirmation is idempotent for duplicate approved result', async () => {
  const transaction = baseTransaction({
    status: PaymentTransactionStatus.APPROVED
  })
  const restore = installPrismaMocks({
    paymentTransactionFindFirst: async () => transaction
  })

  try {
    const result = await new CardPaymentIntentService().confirm({
      organizationId,
      deviceId: 'device-1',
      paymentTransactionId: 'payment-1',
      result: 'APPROVED',
      amountInCents: 1000
    })

    assert.equal(result.paymentTransaction, transaction)
  } finally {
    restore()
  }
})
