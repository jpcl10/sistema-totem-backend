import { prisma } from '../../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'
import {
  catalogProductInclude,
  formatEventProduct
} from './event-product-presenter.js'

interface UpdateEventProductServiceRequest {
  organizationId: string
  userId: string

  eventId: string

  eventProductId: string

  priceInCents?: number | null

  trackStock?: boolean
  stockQuantity?: number | null
  soldOut?: boolean

  active?: boolean
}

export class UpdateEventProductService {
  async execute({
    organizationId,
    userId,
    eventId,
    eventProductId,
    priceInCents,
    trackStock,
    stockQuantity,
    soldOut,
    active
  }: UpdateEventProductServiceRequest) {
    if (trackStock && stockQuantity === undefined) {
      throw new Error('Stock quantity is required when stock tracking is enabled')
    }

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const eventProduct =
      await prisma.eventProduct.findFirst({
        where: {
          id: eventProductId,
          eventId,
          event: {
            organizationId
          }
        },
        include: {
          catalogProduct: {
            include: catalogProductInclude()
          }
        }
      })

    if (!eventProduct) {
      throw new Error('Event product not found')
    }

    const updatedEventProduct =
      await prisma.eventProduct.update({
        where: {
          id: eventProductId
        },
        data: {
          ...(priceInCents !== undefined && {
            priceInCents
          }),

          ...(trackStock !== undefined && {
            trackStock
          }),

          ...(trackStock === false
            ? {
                stockQuantity: null
              }
            : stockQuantity !== undefined
              ? {
                  stockQuantity
                }
              : {}),

          ...(soldOut !== undefined && {
            soldOut
          }),

          ...(active !== undefined && {
            active
          })
        },
        include: {
          catalogProduct: {
            include: catalogProductInclude()
          }
        }
      })

    // Create audit log for event product updated
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      eventId,
      userId,
      entity: 'EventProduct',
      entityId: updatedEventProduct.id,
      action: AuditAction.EVENT_PRODUCT_UPDATED,
      description: 'Produto do evento atualizado',
      metadata: {
        eventProductId: updatedEventProduct.id,
        priceInCents: updatedEventProduct.priceInCents,
        trackStock: updatedEventProduct.trackStock,
        stockQuantity: updatedEventProduct.stockQuantity,
        soldOut: updatedEventProduct.soldOut,
        active: updatedEventProduct.active
      }
    })

    return {
      eventProduct: formatEventProduct(updatedEventProduct)
    }
  }
}
