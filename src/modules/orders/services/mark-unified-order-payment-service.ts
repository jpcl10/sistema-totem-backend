import {
  OnlineOrderPaymentMethod,
  PaymentMethod,
  PaymentStatus,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { MarkOnlineOrderPaymentService } from '../../online-stores/services/mark-online-order-payment-service.js'
import {
  mapEventOrderToUnifiedOrder,
  UnifiedOrderDTO
} from '../presenters/unified-order-presenter.js'
import { MarkOrderPaymentService } from './mark-order-payment-service.js'

export type UnifiedPaymentOrderType = 'EVENT_ORDER' | 'ONLINE_ORDER'

interface MarkUnifiedOrderPaymentServiceRequest {
  organizationId: string
  userRole: UserRole
  userId: string
  orderType: UnifiedPaymentOrderType
  orderId: string
  paymentStatus: PaymentStatus
  paymentMethod?: string | null
  amountReceivedInCents?: number | null
  changeInCents?: number | null
}

const eventOrderInclude = {
  event: {
    select: {
      id: true,
      name: true,
      organizationId: true,
      printingEnabled: true
    }
  },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true
    }
  },
  device: {
    select: {
      id: true,
      type: true,
      name: true
    }
  },
  items: {
    include: {
      options: true
    }
  },
  printJobs: {
    select: {
      id: true,
      status: true
    }
  },
  paymentTransactions: {
    select: {
      id: true
    }
  }
} as const

function parseEventPaymentMethod(paymentMethod?: string | null) {
  if (paymentMethod === undefined || paymentMethod === null) {
    return paymentMethod
  }

  if (!Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
    throw new Error('Invalid payment method')
  }

  return paymentMethod as PaymentMethod
}

function parseOnlinePaymentMethod(paymentMethod?: string | null) {
  if (paymentMethod === undefined || paymentMethod === null) {
    return paymentMethod
  }

  if (
    !Object.values(OnlineOrderPaymentMethod)
      .includes(paymentMethod as OnlineOrderPaymentMethod)
  ) {
    throw new Error('Invalid payment method')
  }

  return paymentMethod as OnlineOrderPaymentMethod
}

export class MarkUnifiedOrderPaymentService {
  async execute({
    organizationId,
    userRole,
    userId,
    orderType,
    orderId,
    paymentStatus,
    paymentMethod,
    amountReceivedInCents,
    changeInCents
  }: MarkUnifiedOrderPaymentServiceRequest): Promise<{ order: UnifiedOrderDTO }> {
    if (paymentStatus !== PaymentStatus.PAID) {
      throw new Error('Invalid payment status transition')
    }

    if (orderType === 'EVENT_ORDER') {
      const order = await prisma.order.findUnique({
        where: {
          id: orderId
        },
        include: {
          event: {
            select: {
              organizationId: true
            }
          }
        }
      })

      if (!order) {
        throw new Error('Order not found')
      }

      if (order.event.organizationId !== organizationId) {
        throw new Error('Access denied')
      }

      await new MarkOrderPaymentService().execute({
        organizationId,
        userRole,
        userId,
        orderId,
        paymentStatus,
        paymentMethod: parseEventPaymentMethod(paymentMethod),
        amountPaidInCents: amountReceivedInCents,
        changeForInCents: changeInCents
      })

      const unifiedOrder = await prisma.order.findUniqueOrThrow({
        where: {
          id: orderId
        },
        include: eventOrderInclude
      })

      return {
        order: mapEventOrderToUnifiedOrder(unifiedOrder)
      }
    }

    const result = await new MarkOnlineOrderPaymentService().execute({
      organizationId,
      userRole,
      userId,
      orderId,
      paymentStatus,
      paymentMethod: parseOnlinePaymentMethod(paymentMethod),
      amountReceivedInCents,
      changeInCents
    })

    return result
  }
}
