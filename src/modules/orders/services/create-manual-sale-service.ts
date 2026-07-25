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
import { catalogOperationError } from '../../catalog/shared/tenant-guard.js'
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
    catalogProductId?: string
    eventProductId?: string
    quantity: number
    notes?: string | null
    selectedOptions?: {
      optionGroupId: string
      optionIds: string[]
    }[]
    selectedFlavorProductIds?: string[]
  }[] 
}

type ResolvedManualSaleItem = CreateManualSaleServiceRequest['items'][number] & {
  catalogProductId: string
  eventProduct: {
    id: string
    catalogProductId: string
    priceInCents: number | null
    trackStock: boolean
    stockQuantity: number | null
    soldOut: boolean
    active: boolean
    catalogProduct: {
      id: string
      name: string
      priceInCents: number
    }
  } | null
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

      const requestedProductIds = items.map(item =>
        item.catalogProductId ?? item.productId
      )
      const requestedEventProductIds = items
        .map(item => item.eventProductId)
        .filter((id): id is string => Boolean(id))

      const eventProducts = await tx.eventProduct.findMany({
        where: {
          eventId,
          OR: [
            {
              id: {
                in: [...requestedProductIds, ...requestedEventProductIds]
              }
            },
            {
              catalogProductId: {
                in: requestedProductIds
              }
            }
          ]
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

      const eventProductById = new Map(eventProducts.map(ep => [ep.id, ep]))
      const eventProductByCatalogId = new Map(
        eventProducts.map(ep => [ep.catalogProductId, ep])
      )
      const catalogProducts = await tx.catalogProduct.findMany({
        where: {
          id: {
            in: requestedProductIds
          },
          organizationId
        },
        select: {
          id: true,
          name: true,
          priceInCents: true,
          active: true,
          catalogCategory: {
            select: {
              active: true
            }
          }
        }
      })
      const catalogProductById = new Map(
        catalogProducts.map(product => [product.id, product])
      )
      const resolvedItems: ResolvedManualSaleItem[] = items.map((item, itemIndex) => {
        const explicitEventProduct = item.eventProductId
          ? eventProductById.get(item.eventProductId)
          : undefined
        const legacyEventProduct = eventProductById.get(item.productId)
        const catalogProductId =
          item.catalogProductId ??
          explicitEventProduct?.catalogProductId ??
          legacyEventProduct?.catalogProductId ??
          item.productId
        const eventProduct =
          explicitEventProduct ??
          legacyEventProduct ??
          eventProductByCatalogId.get(catalogProductId) ??
          null
        const catalogProduct =
          eventProduct?.catalogProduct ?? catalogProductById.get(catalogProductId)

        if (!catalogProduct) {
          throw catalogOperationError({
            code: 'PRODUCT_NOT_FOUND',
            message: 'Produto n\u00e3o encontrado neste cat\u00e1logo.',
            statusCode: 404,
            details: {
              details: {
                productId: item.productId,
                catalogProductId,
                itemIndex
              }
            }
          })
        }

        if (
          ('active' in catalogProduct && catalogProduct.active === false) ||
          ('catalogCategory' in catalogProduct &&
            catalogProduct.catalogCategory?.active === false) ||
          eventProduct?.active === false ||
          eventProduct?.soldOut === true
        ) {
          throw catalogOperationError({
            code: 'PRODUCT_NOT_AVAILABLE',
            message: 'O produto n\u00e3o est\u00e1 dispon\u00edvel para venda neste contexto.',
            statusCode: 409,
            details: {
              details: {
                productId: item.productId,
                catalogProductId,
                eventProductId: eventProduct?.id ?? null,
                itemIndex
              }
            }
          })
        }

        return {
          ...item,
          catalogProductId,
          eventProduct
        }
      })

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

      for (const item of resolvedItems) {
        const eventProduct = item.eventProduct

        if (
          eventProduct?.trackStock &&
          eventProduct.stockQuantity !== null &&
          item.quantity > eventProduct.stockQuantity
        ) {
          throw new Error(
            `Insufficient stock for ${eventProduct.catalogProduct.name}`
          )
        }
      }

      const { orderItemsData, subtotalInCents: totalInCents } =
        await buildConfigurableCatalogOrderItems({
          tx,
          organizationId,
          items: resolvedItems.map(item => {
            const eventProduct = item.eventProduct
            return {
              catalogProductId: item.catalogProductId,
              quantity: item.quantity,
              notes: item.notes,
              selectedOptions: item.selectedOptions,
              selectedFlavorProductIds: item.selectedFlavorProductIds,
              basePriceInCents:
                eventProduct?.priceInCents ??
                eventProduct?.catalogProduct.priceInCents
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

      for (const item of resolvedItems) {
        const eventProduct = item.eventProduct
        if (!eventProduct) {
          continue
        }

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
