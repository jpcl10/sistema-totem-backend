import {
  AuditAction,
  CustomerSource,
  PaymentStatus,
  OrderStatus,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { touchCustomerInteraction } from '../../customers/services/customer-interaction-service.js'
import {
  OrderNotificationService,
  orderNotificationEvents
} from '../../notifications/services/order-notification-service.js'
import { mapEventOrderToUnifiedOrder } from '../presenters/unified-order-presenter.js'
import { buildConfigurableCatalogOrderItems } from './configurable-order-item-builder.js'

interface CreateManualSaleServiceRequest {
  organizationId: string
  userRole: UserRole
  userId: string
  eventId: string
  customerName?: string
  customerId?: string
  paymentMethod: any
  paymentStatus: PaymentStatus
  items: {
    productId: string
    quantity: number
    notes?: string | null
    selectedOptions?: {
      optionGroupId: string
      optionIds: string[]
    }[]
    selectedFlavorProductIds?: string[]
  }[]
}

export class CreateManualSaleService {
  async execute({
    organizationId,
    userId,
    eventId,
    customerName,
    customerId,
    paymentMethod,
    paymentStatus,
    items
  }: CreateManualSaleServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId,
        active: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const order = await prisma.$transaction(async tx => {
      if (customerId) {
        const customer = await tx.customer.findFirst({
          where: {
            id: customerId,
            organizationId,
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

      const eventProductIds = items.map(item => item.productId)

      const eventProducts = await tx.eventProduct.findMany({
        where: {
          id: {
            in: eventProductIds
          },
          eventId,
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

      const lastOrder = await tx.order.findFirst({
        where: {
          eventId
        },
        orderBy: {
          orderNumber: 'desc'
        },
        select: {
          orderNumber: true
        }
      })

      const nextOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1

      for (const item of items) {
        const eventProduct = eventProducts.find(ep => ep.id === item.productId)

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
          organizationId,
          items: items.map(item => {
            const eventProduct = eventProductById.get(item.productId)!
            return {
              catalogProductId: eventProduct.catalogProductId,
              quantity: item.quantity,
              notes: item.notes,
              selectedOptions: item.selectedOptions,
              selectedFlavorProductIds: item.selectedFlavorProductIds,
              basePriceInCents:
                eventProduct.priceInCents ??
                eventProduct.catalogProduct.priceInCents
            }
          })
        })

      const isPaid = paymentStatus === PaymentStatus.PAID

      const createdOrder = await tx.order.create({
        data: {
          eventId,
          customerId: customerId ?? null,
          customerName: customerName || 'Venda manual',
          orderNumber: nextOrderNumber,
          status: OrderStatus.CONFIRMED,
          paymentStatus,
          paymentMethod,
          totalInCents,
          amountPaidInCents: isPaid ? totalInCents : null,
          paidAt: isPaid ? new Date() : null,
          paymentNotes: 'Venda manual criada pelo painel',
          items: {
            create: orderItemsData
          }
        },
        include: {
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
          organizationId,
          source: CustomerSource.POS,
          seenAt: createdOrder.createdAt
        })
      }

      for (const item of items) {
        const eventProduct = eventProducts.find(ep => ep.id === item.productId)!

        if (eventProduct.trackStock && eventProduct.stockQuantity !== null) {
          const result = await tx.eventProduct.updateMany({
            where: {
              id: eventProduct.id,
              stockQuantity: {
                gte: item.quantity
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

    const createPrintJobsForOrderService = new CreatePrintJobsForOrderService()

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

    const createAuditLogService = new CreateAuditLogService()

    await createAuditLogService.execute({
      organizationId: event.organizationId,
      eventId,
      userId,
      entity: 'Order',
      entityId: order.id,
      action: AuditAction.ORDER_CREATED,
      description: 'Venda manual criada',
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalAmount: order.totalInCents,
        paymentMethod,
        paymentStatus
      }
    })

    return {
      order
    }
  }
}
