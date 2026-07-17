import {
  CustomerSource,
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  OnlineOrderStatus,
  OrderSource,
  PaymentStatus,
  SettingsChannel
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { mapOnlineOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js'
import { OnlineStoreSettingsService } from '../../settings/services/online-store-settings-service.js'
import { OrderPrintOrchestratorService } from '../../print-jobs/services/order-print-orchestrator-service.js'
import { touchCustomerInteraction } from '../../customers/services/customer-interaction-service.js'
import { ResolveOrderCustomerIdentityService } from '../../customers/services/order-customer-identity-service.js'
import {
  OrderNotificationService,
  orderNotificationEvents
} from '../../notifications/services/order-notification-service.js'
import { buildOnlineOrderItems } from './online-order-items-builder.js'

interface CreateManualOnlineOrderItemRequest {
  catalogProductId: string
  quantity: number
  notes?: string | null
  selectedOptions?: {
    optionGroupId: string
    optionIds: string[]
  }[]
}

interface CreateManualOnlineOrderDeliveryRequest {
  label?: string | null
  address: string
  number: string
  neighborhood: string
  city?: string | null
  state?: string | null
  postalCode?: string | null
  complement?: string | null
  reference?: string | null
}

interface CreateManualOnlineOrderCustomerRequest {
  name?: string | null
  phone?: string | null
  email?: string | null
  document?: string | null
  notes?: string | null
}

interface CreateManualOnlineOrderServiceRequest {
  organizationId: string
  storeId: string
  customerId?: string | null
  customer?: CreateManualOnlineOrderCustomerRequest | null
  customerAddressId?: string | null
  fulfillment: OnlineOrderFulfillmentType
  delivery?: CreateManualOnlineOrderDeliveryRequest | null
  paymentMethod: OnlineOrderPaymentMethod
  paymentStatus: PaymentStatus
  amountReceivedInCents?: number | null
  notes?: string | null
  items: CreateManualOnlineOrderItemRequest[]
}

const pickupDeliverySnapshot = {
  address: 'Retirada no balc\u00e3o',
  number: 'S/N',
  neighborhood: 'Loja',
  complement: null,
  reference: null
}

export class CreateManualOnlineOrderService {
  async execute(request: CreateManualOnlineOrderServiceRequest) {
    const store = await prisma.onlineStore.findFirst({
      where: {
        id: request.storeId,
        organizationId: request.organizationId,
        active: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        organizationId: true
      }
    })

    if (!store) {
      throw new Error('Store not found')
    }

    const order = await prisma.$transaction(async tx => {
      const requestedName = request.customer?.name?.trim() || null

      const deliverySnapshot =
        request.fulfillment === 'DELIVERY' && request.delivery
          ? {
              address: request.delivery.address,
              number: request.delivery.number,
              neighborhood: request.delivery.neighborhood,
              complement: request.delivery.complement ?? null,
              reference: request.delivery.reference ?? null
            }
          : pickupDeliverySnapshot

      const { customer, address: customerAddress } =
        await new ResolveOrderCustomerIdentityService().execute({
          tx,
          organizationId: request.organizationId,
          source: CustomerSource.ADMIN,
          customer: {
            id: request.customerId,
            name: request.customer?.name,
            phone: request.customer?.phone,
            email: request.customer?.email,
            document: request.customer?.document,
            notes: request.customer?.notes
          },
          address:
            request.fulfillment === OnlineOrderFulfillmentType.DELIVERY
              ? {
                  id: request.customerAddressId,
                  label: request.delivery?.label,
                  recipientName: requestedName,
                  street: deliverySnapshot.address,
                  number: deliverySnapshot.number,
                  neighborhood: deliverySnapshot.neighborhood,
                  city: request.delivery?.city,
                  state: request.delivery?.state,
                  postalCode: request.delivery?.postalCode,
                  complement: deliverySnapshot.complement,
                  reference: deliverySnapshot.reference
                }
              : null,
          shouldResolveAddress:
            request.fulfillment === OnlineOrderFulfillmentType.DELIVERY,
          fallbackCustomerName: requestedName ?? 'Cliente balc\u00e3o',
          fallbackCustomerPhone: request.customer?.phone
        })

      const finalDeliverySnapshot =
        request.fulfillment === OnlineOrderFulfillmentType.DELIVERY
          ? {
              address: customerAddress?.street ?? deliverySnapshot.address,
              number: customerAddress?.number ?? deliverySnapshot.number,
              neighborhood:
                customerAddress?.neighborhood ?? deliverySnapshot.neighborhood,
              complement:
                customerAddress?.complement ?? deliverySnapshot.complement,
              reference:
                customerAddress?.reference ?? deliverySnapshot.reference
            }
          : deliverySnapshot

      const {
        orderItemsData,
        subtotalInCents
      } = await buildOnlineOrderItems({
        tx,
        organizationId: request.organizationId,
        items: request.items
      })

      const operation =
        await new OnlineStoreSettingsService().resolveOperation({
          organizationId: request.organizationId,
          storeId: store.id,
          channel:
            request.fulfillment === OnlineOrderFulfillmentType.DELIVERY
              ? SettingsChannel.DELIVERY
              : SettingsChannel.PICKUP,
          fulfillmentType: request.fulfillment,
          subtotalInCents,
          neighborhood: finalDeliverySnapshot.neighborhood
        })

      if (!operation.delivery.acceptingOrders) {
        throw new Error(operation.delivery.unavailableReason ?? 'Store is currently unavailable')
      }

      const deliveryFeeInCents =
        request.fulfillment === OnlineOrderFulfillmentType.DELIVERY
          ? operation.delivery.deliveryFeeInCents ?? 0
          : 0

      const lastOrder = await tx.onlineOrder.findFirst({
        where: { storeId: store.id },
        orderBy: { orderNumber: 'desc' }
      })

      const orderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1
      const customerName = requestedName ?? customer?.name ?? 'Cliente balc\u00e3o'
      const customerPhone = request.customer?.phone ?? customer?.phone ?? ''

      const createdOrder = await tx.onlineOrder.create({
        data: {
          storeId: store.id,
          orderNumber,
          source: OrderSource.ADMIN,
          fulfillmentType: request.fulfillment,
          deliveryRuleId: operation.delivery.deliveryFeeRule?.id ?? null,
          estimatedMinutes: operation.delivery.estimatedMinutes,
          customerId: customer?.id ?? null,
          customerAddressId: customerAddress?.id ?? null,
          customerName,
          customerPhone,
          deliveryAddress: finalDeliverySnapshot.address,
          deliveryNumber: finalDeliverySnapshot.number,
          deliveryNeighborhood: finalDeliverySnapshot.neighborhood,
          deliveryComplement: finalDeliverySnapshot.complement,
          deliveryReference: finalDeliverySnapshot.reference,
          paymentMethod: request.paymentMethod,
          paymentStatus: request.paymentStatus,
          paidAt:
            request.paymentStatus === PaymentStatus.PAID
              ? new Date()
              : null,
          changeForInCents:
            request.paymentMethod === OnlineOrderPaymentMethod.CASH
              ? request.amountReceivedInCents ?? null
              : null,
          subtotalInCents,
          deliveryFeeInCents,
          totalInCents: subtotalInCents + deliveryFeeInCents,
          status: OnlineOrderStatus.RECEIVED,
          notes: request.notes ?? null,
          items: {
            create: orderItemsData
          }
        },
        include: {
          store: {
            select: {
              id: true,
              slug: true,
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
          items: {
            include: {
              options: true
            }
          }
        }
      })

      if (customer) {
        await touchCustomerInteraction(tx, {
          customerId: customer.id,
          organizationId: request.organizationId,
          source: CustomerSource.ADMIN,
          seenAt: createdOrder.createdAt
        })
      }

      return createdOrder
    })

    if (io) {
      io.to(`organization:${store.organizationId}`).emit('online-order-created', {
        storeId: store.id,
        order
      })

      io.to(`organization:${store.organizationId}`).emit('unified-order-created', {
        order: mapOnlineOrderToUnifiedOrder(order)
      })
    }

    await new OrderNotificationService().publishOrderEvent(
      orderNotificationEvents.ORDER_CREATED,
      {
        organizationId: store.organizationId,
        orderId: order.id,
        orderType: 'ONLINE_ORDER',
        customerId: order.customerId,
        customerPhone: order.customerPhone,
        customerName: order.customerName,
        orderNumber: order.orderNumber
      }
    )

    await new OrderPrintOrchestratorService().execute({
      domain: 'ONLINE_ORDER',
      orderId: order.id
    })

    const orderWithPrintJobs = await prisma.onlineOrder.findUnique({
      where: {
        id: order.id
      },
      include: {
        store: {
          select: {
            id: true,
            slug: true,
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
        }
      }
    })

    if (io && orderWithPrintJobs) {
      io.to(`organization:${store.organizationId}`).emit('unified-order-updated', {
        order: mapOnlineOrderToUnifiedOrder(orderWithPrintJobs)
      })
    }

    return {
      order
    }
  }
}
