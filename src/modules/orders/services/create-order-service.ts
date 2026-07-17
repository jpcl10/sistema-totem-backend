import { AuditAction, CustomerSource, PaymentStatus } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { touchCustomerInteraction } from '../../customers/services/customer-interaction-service.js'
import {
  OrderNotificationService,
  orderNotificationEvents
} from '../../notifications/services/order-notification-service.js'
import { mapEventOrderToUnifiedOrder } from '../presenters/unified-order-presenter.js'

interface CreateOrderServiceRequest {
  eventSlug: string

  deviceId?: string | null

  customerName?: string
  customerId?: string

  paymentStatus?: PaymentStatus

  items: {
    productId: string
    quantity: number
    selectedOptions?: {
      optionGroupId: string
      optionIds: string[]
    }[]
  }[]
}

export class CreateOrderService {
  async execute({
    eventSlug,
    deviceId,
    customerName,
    customerId,
    paymentStatus,
    items
  }: CreateOrderServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        slug: eventSlug,
        active: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
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

      // Calcular total e preparar order items
      let totalInCents = 0
      const orderItemsData = []

      for (const item of items) {
        const eventProduct = eventProducts.find(
          ep => ep.id === item.productId
        )!
        const catalogProduct = eventProduct.catalogProduct
        const optionGroups = catalogProduct.optionGroups

        // Validate selected options
        const selectedOptionsMap = new Map<string, string[]>()
        if (item.selectedOptions) {
          for (const selected of item.selectedOptions) {
            if (selectedOptionsMap.has(selected.optionGroupId)) {
              throw new Error(`Duplicate option group: ${selected.optionGroupId}`)
            }
            selectedOptionsMap.set(selected.optionGroupId, selected.optionIds)
          }
        }

        // Check required groups and min/max selections
        const optionSnapshots = []
        let optionsTotalDeltaInCents = 0

        for (const group of optionGroups) {
          const selectedOptionIds = selectedOptionsMap.get(group.id) || []

          // Check required
          if (group.required && selectedOptionIds.length === 0) {
            throw new Error(`Option group "${group.name}" is required`)
          }

          // Check min selections
          if (selectedOptionIds.length < group.minSelections) {
            throw new Error(`Option group "${group.name}" requires at least ${group.minSelections} selections`)
          }

          // Check max selections
          if (selectedOptionIds.length > group.maxSelections) {
            throw new Error(`Option group "${group.name}" allows at most ${group.maxSelections} selections`)
          }

          // Validate each selected option
          for (const optionId of selectedOptionIds) {
            const option = group.options.find(o => o.id === optionId)
            if (!option) {
              throw new Error(`Option "${optionId}" not found in group "${group.name}"`)
            }

            optionsTotalDeltaInCents += option.priceDeltaInCents

            // Get linked product name if applicable
            let linkedProductName: string | null = null
            if (option.linkedProductId) {
              const linkedProduct = await tx.catalogProduct.findFirst({
                where: {
                  id: option.linkedProductId,
                  organizationId: event.organizationId,
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

          // Remove from map to check for unknown groups later
          selectedOptionsMap.delete(group.id)
        }

        // Check for unknown option groups
        if (selectedOptionsMap.size > 0) {
          const unknownGroupIds = Array.from(selectedOptionsMap.keys())
          throw new Error(`Unknown option groups: ${unknownGroupIds.join(', ')}`)
        }

        // Calculate prices
        const basePriceInCents = eventProduct.priceInCents ?? catalogProduct.priceInCents
        const unitPriceInCents = basePriceInCents + optionsTotalDeltaInCents
        const itemTotalInCents = unitPriceInCents * item.quantity
        totalInCents += itemTotalInCents

        orderItemsData.push({
          catalogProductId: eventProduct.catalogProductId,
          quantity: item.quantity,
          unitPriceInCents: unitPriceInCents,
          totalInCents: itemTotalInCents,
          productName: catalogProduct.name,
          options: {
            create: optionSnapshots
          }
        })
      }

      // Criar pedido
      const createdOrder = await tx.order.create({
        data: {
          eventId: event.id,
          deviceId: deviceId ?? null,
          customerId: customerId ?? null,
          customerName,
          orderNumber: nextOrderNumber,
          paymentStatus: paymentStatus ?? PaymentStatus.PENDING,
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
              options: true
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
        totalAmount: order.totalInCents
      }
    })

    return {
      order
    }
  }
}
