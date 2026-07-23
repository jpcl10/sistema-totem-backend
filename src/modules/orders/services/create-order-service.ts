import {
  AuditAction,
  CustomerSource,
  OrderSource,
  PaymentMethod,
  PaymentStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { touchCustomerInteraction } from '../../customers/services/customer-interaction-service.js'
import {
  OrderNotificationService,
  orderNotificationEvents
} from '../../notifications/services/order-notification-service.js'
import {
  resolveCanonicalPublicEvent,
  resolveLegacyPublicEventSlug
} from '../../events/services/public-event-resolver.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'
import { mapEventOrderToUnifiedOrder } from '../presenters/unified-order-presenter.js'
import { buildConfigurableCatalogOrderItems } from './configurable-order-item-builder.js'

interface CreateOrderServiceRequest {
  eventSlug: string
  organizationSlug?: string | null

  deviceId?: string | null

  customerName?: string
  customerId?: string
  checkoutContext?: 'TOTEM' | 'PUBLIC_EVENT'
  paymentMethod?: 'PIX' | 'CARD' | 'PIX_AUTOMATIC' | 'CREDIT_CARD' | 'DEBIT_CARD'

  paymentStatus?: PaymentStatus

  items: {
    productId: string
    quantity: number
    selectedOptions?: {
      optionGroupId: string
      optionIds: string[]
    }[]
    selectedFlavorProductIds?: string[]
  }[]
}

export class CreateOrderService {
  async execute({
    eventSlug,
    organizationSlug,
    deviceId,
    customerName,
    customerId,
    checkoutContext,
    paymentMethod,
    paymentStatus,
    items
  }: CreateOrderServiceRequest) {
    if (
      checkoutContext === 'TOTEM' &&
      paymentMethod &&
      !['PIX', 'CARD'].includes(paymentMethod)
    ) {
      throw new Error('Totem orders only allow PIX or CARD payment methods')
    }

    if (
      checkoutContext === 'TOTEM' &&
      (
        paymentStatus === PaymentStatus.PAID ||
        paymentStatus === PaymentStatus.NOT_REQUIRED
      )
    ) {
      throw new Error('Totem orders cannot be created as paid')
    }

    const effectivePaymentMethod =
      paymentMethod === 'PIX' || (
        checkoutContext !== 'TOTEM' &&
        paymentMethod === 'PIX_AUTOMATIC'
      )
        ? PaymentMethod.PIX_AUTOMATIC
        : paymentMethod === 'CARD' || (
          checkoutContext !== 'TOTEM' &&
          paymentMethod === 'CREDIT_CARD'
        )
          ? PaymentMethod.CREDIT_CARD
          : checkoutContext !== 'TOTEM' && paymentMethod === 'DEBIT_CARD'
            ? PaymentMethod.DEBIT_CARD
            : null

    const orderSource =
      checkoutContext === 'TOTEM'
        ? OrderSource.TOTEM
        : OrderSource.EVENT

    const resolvedEvent = organizationSlug
      ? await resolveCanonicalPublicEvent({
          organizationSlug,
          eventSlug
        })
      : await resolveLegacyPublicEventSlug(eventSlug)

    const event = await prisma.event.findFirst({
      where: {
        id: resolvedEvent.id,
        organizationId: resolvedEvent.organizationId,
        active: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    if (checkoutContext === 'TOTEM') {
      const paymentSettings =
        await new PaymentSettingsResolver().resolve({
          organizationId: event.organizationId,
          contextType: 'EVENT',
          eventId: event.id
        })

      if (paymentMethod === 'PIX' && !paymentSettings.methods.pix) {
        throw new Error('PIX is disabled for this event')
      }

      if (
        paymentMethod === 'CARD' &&
        !paymentSettings.methods.credit &&
        !paymentSettings.methods.debit
      ) {
        throw new Error('Card payment is disabled for this event')
      }
    }

    if (deviceId) {
      const device = await prisma.device.findFirst({
        where: {
          id: deviceId,
          organizationId: event.organizationId,
          OR: [
            {
              eventId: event.id
            },
            {
              eventId: null
            }
          ]
        },
        select: {
          id: true
        }
      })

      if (!device) {
        throw new Error('Device not allowed for this event')
      }
    }

    const order = await prisma.$transaction(async tx => {
      if (customerId) {
        const customer = await tx.customer.findFirst({
          where: {
            id: customerId,
            organizationId: event.organizationId,
            active: true
          },
          select: {
            id: true
          }
        })

        if (!customer) {
          throw new Error('Customer not found')
        }
      }

      const eventProductIds = items.map(
        item => item.productId
      )

      const eventProducts =
        await tx.eventProduct.findMany({
          where: {
            id: {
              in: eventProductIds
            },
            eventId: event.id,
            active: true,
            soldOut: false
          },
          include: {
            catalogProduct: {
              include: {
                optionGroups: {
                  where: {
                    active: true
                  },
                  include: {
                    options: {
                      where: {
                        active: true
                      }
                    }
                  }
                }
              }
            }
          }
        })

      if (eventProducts.length !== items.length) {
        throw new Error('Some products were not found or are unavailable')
      }

      // Calcular próximo orderNumber dentro da transação
      const lastOrder = await tx.order.findFirst({
        where: {
          eventId: event.id
        },
        orderBy: {
          orderNumber: 'desc'
        },
        select: {
          orderNumber: true
        }
      })

      const nextOrderNumber = lastOrder
        ? lastOrder.orderNumber + 1
        : 1

      // Verificar estoque para cada item (usando os dados dentro da transação)
      for (const item of items) {
        const eventProduct = eventProducts.find(
          ep => ep.id === item.productId
        )

        if (!eventProduct) {
          throw new Error('Product not found')
        }

        if (
          eventProduct.trackStock &&
          eventProduct.stockQuantity !== null &&
          item.quantity > eventProduct.stockQuantity
        ) {
          throw new Error(
            `Insufficient stock for ${eventProduct.catalogProduct.name}`
          )
        }
      }

      const eventProductById = new Map(eventProducts.map(ep => [ep.id, ep]))
      const { orderItemsData, subtotalInCents: totalInCents } =
        await buildConfigurableCatalogOrderItems({
          tx,
          organizationId: event.organizationId,
          items: items.map(item => {
            const eventProduct = eventProductById.get(item.productId)!
            return {
              catalogProductId: eventProduct.catalogProductId,
              quantity: item.quantity,
              selectedOptions: item.selectedOptions,
              selectedFlavorProductIds: item.selectedFlavorProductIds,
              basePriceInCents:
                eventProduct.priceInCents ??
                eventProduct.catalogProduct.priceInCents
            }
          })
        })

      // Criar pedido
      const createdOrder = await tx.order.create({
        data: {
          eventId: event.id,
          deviceId: deviceId ?? null,
          customerId: customerId ?? null,
          source: orderSource,
          customerName,
          orderNumber: nextOrderNumber,
          paymentStatus:
            checkoutContext === 'TOTEM'
              ? PaymentStatus.PENDING
              : paymentStatus ?? PaymentStatus.PENDING,
          paymentMethod: effectivePaymentMethod,
          totalInCents,
          items: {
            create: orderItemsData
          }
        },
        include: {
          device: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              locationName: true
            }
          },
          items: {
            include: {
              catalogProduct: {
                include: {
                  catalogCategory: true
                }
              },
              options: true,
              flavors: true
            }
          }
        }
      })

      if (customerId) {
        await touchCustomerInteraction(tx, {
          customerId,
          organizationId: event.organizationId,
          source: deviceId ? CustomerSource.TOTEM : CustomerSource.EVENT,
          seenAt: createdOrder.createdAt
        })
      }

      // Atualizar estoque de forma atômica
      for (const item of items) {
        const eventProduct = eventProducts.find(
          ep => ep.id === item.productId
        )!

        if (
          eventProduct.trackStock &&
          eventProduct.stockQuantity !== null
        ) {
          const result = await tx.eventProduct.updateMany({
            where: {
              id: eventProduct.id,
              stockQuantity: {
                gte: item.quantity // Garante que temos estoque suficiente
              }
            },
            data: {
              stockQuantity: {
                decrement: item.quantity
              },
              soldOut: {
                set: eventProduct.stockQuantity - item.quantity <= 0
              }
            }
          })

          if (result.count === 0) {
            // Se nenhum registro foi atualizado, significa que o estoque foi alterado
            // por outra transação e não temos mais estoque suficiente
            throw new Error(
              `Insufficient stock for ${eventProduct.catalogProduct.name}`
            )
          }
        }
      }

      return createdOrder
    })

    if (io) {
      io.to(`event:${event.id}`).emit('order-created', {
        order
      })

      io.to(`event:${event.id}`).emit('unified-order-created', {
        order: mapEventOrderToUnifiedOrder({
          ...order,
          event
        })
      })

      io.to(`organization:${event.organizationId}`).emit('unified-order-created', {
        order: mapEventOrderToUnifiedOrder({
          ...order,
          event
        })
      })
    }

    const createPrintJobsForOrderService =
      new CreatePrintJobsForOrderService()

    await createPrintJobsForOrderService.execute({
      orderId: order.id
    })

    await new OrderNotificationService().publishOrderEvent(
      orderNotificationEvents.ORDER_CREATED,
      {
        organizationId: event.organizationId,
        orderId: order.id,
        orderType: 'EVENT_ORDER',
        customerId: order.customerId,
        customerPhone: null,
        customerName: order.customerName,
        orderNumber: order.orderNumber
      }
    )

    // Audit: ORDER_CREATED
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: event.organizationId,
      eventId: event.id,
      deviceId: deviceId ?? null,
      entity: 'Order',
      entityId: order.id,
      action: AuditAction.ORDER_CREATED,
      description: 'Pedido criado',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalAmount: order.totalInCents,
        checkoutContext: checkoutContext ?? null,
        paymentMethod: effectivePaymentMethod,
        source: orderSource
      }
    })

    return {
      order
    }
  }
}
