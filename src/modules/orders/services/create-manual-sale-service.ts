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

      let totalInCents = 0

      const orderItemsData = []

      for (const item of items) {
        const eventProduct = eventProducts.find(
          ep => ep.id === item.productId
        )!
        const catalogProduct = eventProduct.catalogProduct
        const selectedOptionsMap = new Map<string, string[]>()

        for (const selected of item.selectedOptions ?? []) {
          if (selectedOptionsMap.has(selected.optionGroupId)) {
            throw new Error(`Duplicate option group: ${selected.optionGroupId}`)
          }

          selectedOptionsMap.set(selected.optionGroupId, selected.optionIds)
        }

        const optionSnapshots = []
        let optionsTotalDeltaInCents = 0

        for (const group of catalogProduct.optionGroups) {
          const selectedOptionIds = selectedOptionsMap.get(group.id) || []

          if (group.required && selectedOptionIds.length === 0) {
            throw new Error(`Option group "${group.name}" is required`)
          }

          if (selectedOptionIds.length < group.minSelections) {
            throw new Error(`Option group "${group.name}" requires at least ${group.minSelections} selections`)
          }

          if (selectedOptionIds.length > group.maxSelections) {
            throw new Error(`Option group "${group.name}" allows at most ${group.maxSelections} selections`)
          }

          for (const optionId of selectedOptionIds) {
            const option = group.options.find(currentOption => currentOption.id === optionId)

            if (!option) {
              throw new Error(`Option "${optionId}" not found in group "${group.name}"`)
            }

            optionsTotalDeltaInCents += option.priceDeltaInCents

            let linkedProductName: string | null = null

            if (option.linkedProductId) {
              const linkedProduct = await tx.catalogProduct.findFirst({
                where: {
                  id: option.linkedProductId,
                  organizationId,
                  active: true
                },
                select: {
                  name: true
                }
              })

              if (linkedProduct) {
                linkedProductName = linkedProduct.name
              }
            }

            optionSnapshots.push({
              optionGroupId: group.id,
              optionId: option.id,
              linkedProductId: option.linkedProductId,
              groupName: group.name,
              optionName: linkedProductName || option.name,
              priceDeltaInCents: option.priceDeltaInCents
            })
          }

          selectedOptionsMap.delete(group.id)
        }

        if (selectedOptionsMap.size > 0) {
          const unknownGroupIds = Array.from(selectedOptionsMap.keys())
          throw new Error(`Unknown option groups: ${unknownGroupIds.join(', ')}`)
        }

        const basePriceInCents = eventProduct.priceInCents ?? catalogProduct.priceInCents
        const unitPriceInCents = basePriceInCents + optionsTotalDeltaInCents
        const itemTotal = unitPriceInCents * item.quantity
        totalInCents += itemTotal

        orderItemsData.push({
          catalogProductId: eventProduct.catalogProductId,
          quantity: item.quantity,
          unitPriceInCents,
          totalInCents: itemTotal,
          productName: catalogProduct.name,
          notes: item.notes ?? null,
          options: {
            create: optionSnapshots
          }
        })
      }

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
              options: true
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
