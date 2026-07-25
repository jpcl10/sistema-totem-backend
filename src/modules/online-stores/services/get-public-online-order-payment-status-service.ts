import { PaymentMethod, PaymentProvider } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

export class PublicOnlineOrderPaymentStatusNotFoundError extends Error {
  constructor() {
    super('Online order not found')
  }
}

export class GetPublicOnlineOrderPaymentStatusService {
  async execute({ orderId }: { orderId: string }) {
    const order = await prisma.onlineOrder.findUnique({
      where: {
        id: orderId
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        paidAt: true,
        paymentTransactions: {
          where: {
            provider: PaymentProvider.MERCADO_PAGO,
            method: PaymentMethod.PIX_AUTOMATIC
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            id: true,
            status: true,
            qrCode: true,
            qrCodeBase64: true,
            pixCopyPaste: true,
            gatewayStatus: true,
            metadata: true,
            expiresAt: true
          }
        }
      }
    })

    if (!order) {
      throw new PublicOnlineOrderPaymentStatusNotFoundError()
    }

    const transaction = order.paymentTransactions[0] ?? null
    const metadata =
      transaction?.metadata && typeof transaction.metadata === 'object'
        ? transaction.metadata as Record<string, unknown>
        : null

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      transaction: transaction
        ? {
            status: transaction.status,
            qrCode: transaction.qrCode ?? transaction.pixCopyPaste ?? null,
            qrCodeBase64: transaction.qrCodeBase64 ?? null,
            ticketUrl: typeof metadata?.ticketUrl === 'string' ? metadata.ticketUrl : null,
            expiresAt: transaction.expiresAt?.toISOString() ?? null,
            providerStatus: transaction.gatewayStatus ?? null
          }
        : null,
      paidAt: order.paidAt?.toISOString() ?? null
    }
  }
}
