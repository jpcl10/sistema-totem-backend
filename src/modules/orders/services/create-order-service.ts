import { PaymentStatus, AuditAction } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { io } from '../../../lib/socket.js'
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface CreateOrderServiceRequest {
  eventSlug: string

  deviceId?: string | null

  customerName?: string

  paymentStatus?: PaymentStatus

  items: {
    productId: string
    quantity: number
  }[]
}

export class CreateOrderService {
  async execute({
    eventSlug,
    deviceId,
    customerName,
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
            catalogProduct: true
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
      const orderItemsData = items.map(item => {
        const eventProduct = eventProducts.find(
          ep => ep.id === item.productId
        )!

        const itemTotal = eventProduct.priceInCents * item.quantity
        totalInCents += itemTotal

        return {
          catalogProductId: eventProduct.catalogProductId,
          quantity: item.quantity,
          unitPriceInCents: eventProduct.priceInCents,
          totalInCents: itemTotal,
          productName: eventProduct.catalogProduct.name
        }
      })

      // Criar pedido
      const createdOrder = await tx.order.create({
        data: {
          eventId: event.id,
          deviceId: deviceId ?? null,
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
              }
            }
          }
        }
      })

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

    io.to(`event:${event.id}`).emit('order-created', {
      order
    })

    const createPrintJobsForOrderService =
      new CreatePrintJobsForOrderService()

    await createPrintJobsForOrderService.execute({
      orderId: order.id
    })

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