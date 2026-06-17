import { prisma } from '../../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface UpdateEventProductServiceRequest {
  organizationId: string

  eventId: string

  eventProductId: string

  priceInCents?: number

  trackStock?: boolean
  stockQuantity?: number | null
  soldOut?: boolean

  active?: boolean
}

export class UpdateEventProductService {
  async execute({
    organizationId,
    eventId,
    eventProductId,
    priceInCents,
    trackStock,
    stockQuantity,
    soldOut,
    active
  }: UpdateEventProductServiceRequest) {

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
          eventId
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

          ...(stockQuantity !== undefined && {
            stockQuantity
          }),

          ...(soldOut !== undefined && {
            soldOut
          }),

          ...(active !== undefined && {
            active
          })
        }
      })

    // Create audit log for event product updated
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      eventId,
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
      eventProduct: updatedEventProduct
    }
  }
}