import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OnlineOrderPaymentMethod,
  OnlineOrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import {
  GetPublicOnlineOrderPaymentStatusService,
  PublicOnlineOrderPaymentStatusNotFoundError
} from './get-public-online-order-payment-status-service.js'

test('public payment status looks up by OnlineOrder.id and returns pending PIX QR code', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  const calls: any[] = []
  const expiresAt = new Date('2026-07-25T20:00:00.000Z')

  ;(prisma.onlineOrder.findUnique as any) = async (args: any) => {
    calls.push(args)
    return {
      id: 'online-order-1',
      orderNumber: 15,
      status: OnlineOrderStatus.RECEIVED,
      paymentMethod: OnlineOrderPaymentMethod.PIX,
      paymentStatus: PaymentStatus.PENDING,
      paidAt: null,
      paymentTransactions: [
        {
          id: 'tx-1',
          status: PaymentTransactionStatus.WAITING_PAYMENT,
          qrCode: null,
          qrCodeBase64: 'base64-pix',
          pixCopyPaste: 'copy-paste-pix',
          gatewayStatus: 'pending',
          metadata: { ticketUrl: 'https://ticket.example/pix' },
          expiresAt
        }
      ]
    }
  }

  try {
    const result = await new GetPublicOnlineOrderPaymentStatusService().execute({
      orderId: 'online-order-1'
    })

    assert.equal(calls[0].where.id, 'online-order-1')
    assert.equal(calls[0].select.paymentTransactions.where.provider, PaymentProvider.MERCADO_PAGO)
    assert.equal(calls[0].select.paymentTransactions.where.method, PaymentMethod.PIX_AUTOMATIC)
    assert.equal(result.orderId, 'online-order-1')
    assert.equal(result.paymentStatus, PaymentStatus.PENDING)
    assert.equal(result.transaction?.qrCode, 'copy-paste-pix')
    assert.equal(result.transaction?.qrCodeBase64, 'base64-pix')
    assert.equal(result.transaction?.expiresAt, expiresAt.toISOString())
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
  }
})

test('public payment status returns paid status for approved PIX', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  const paidAt = new Date('2026-07-25T20:01:00.000Z')

  ;(prisma.onlineOrder.findUnique as any) = async () => ({
    id: 'online-order-paid',
    orderNumber: 16,
    status: OnlineOrderStatus.CONFIRMED,
    paymentMethod: OnlineOrderPaymentMethod.PIX,
    paymentStatus: PaymentStatus.PAID,
    paidAt,
    paymentTransactions: [
      {
        id: 'tx-paid',
        status: PaymentTransactionStatus.APPROVED,
        qrCode: 'qr',
        qrCodeBase64: null,
        pixCopyPaste: null,
        gatewayStatus: 'approved',
        metadata: {},
        expiresAt: null
      }
    ]
  })

  try {
    const result = await new GetPublicOnlineOrderPaymentStatusService().execute({
      orderId: 'online-order-paid'
    })

    assert.equal(result.paymentStatus, PaymentStatus.PAID)
    assert.equal(result.transaction?.status, PaymentTransactionStatus.APPROVED)
    assert.equal(result.paidAt, paidAt.toISOString())
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
  }
})

test('public payment status returns expired transaction status without leaking unrelated tenant data', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  const calls: any[] = []

  ;(prisma.onlineOrder.findUnique as any) = async (args: any) => {
    calls.push(args)
    return {
      id: 'online-order-expired',
      orderNumber: 17,
      status: OnlineOrderStatus.RECEIVED,
      paymentMethod: OnlineOrderPaymentMethod.PIX,
      paymentStatus: PaymentStatus.FAILED,
      paidAt: null,
      paymentTransactions: [
        {
          id: 'tx-expired',
          status: PaymentTransactionStatus.EXPIRED,
          qrCode: null,
          qrCodeBase64: null,
          pixCopyPaste: null,
          gatewayStatus: 'expired',
          metadata: { accessToken: 'must-not-leak' },
          expiresAt: null
        }
      ]
    }
  }

  try {
    const result = await new GetPublicOnlineOrderPaymentStatusService().execute({
      orderId: 'online-order-expired'
    })

    assert.equal(calls[0].where.id, 'online-order-expired')
    assert.equal(result.transaction?.status, PaymentTransactionStatus.EXPIRED)
    assert.deepEqual(Object.keys(result.transaction ?? {}).sort(), [
      'expiresAt',
      'providerStatus',
      'qrCode',
      'qrCodeBase64',
      'status',
      'ticketUrl'
    ])
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
  }
})

test('public payment status returns not found for missing online order', async () => {
  const originalFindUnique = prisma.onlineOrder.findUnique
  ;(prisma.onlineOrder.findUnique as any) = async () => null

  try {
    await assert.rejects(
      () => new GetPublicOnlineOrderPaymentStatusService().execute({ orderId: 'missing' }),
      PublicOnlineOrderPaymentStatusNotFoundError
    )
  } finally {
    ;(prisma.onlineOrder.findUnique as any) = originalFindUnique
  }
})
