import { prisma } from '../../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'
import {
  catalogProductInclude,
  formatEventProduct
} from './event-product-presenter.js'

interface CreateEventProductServiceRequest {
  organizationId: string
  userId: string

  eventId: string

  catalogProductId: string

  priceInCents?: number | null
  active?: boolean
  trackStock?: boolean
  stockQuantity?: number | null
}

export class CreateEventProductService {
  async execute({
    organizationId,
    userId,
    eventId,
    catalogProductId,
    priceInCents,
    active,
    trackStock,
    stockQuantity
  }: CreateEventProductServiceRequest) {
    if (trackStock && stockQuantity === undefined) {
      throw new Error('Stock quantity is required when stock tracking is enabled')
    }

    const event =
      await prisma.event.findFirst({
        where: {
          id: eventId,
          organizationId
        }
      })

    if (!event) {
      throw new Error('Event not found')
    }

    const catalogProduct =
      await prisma.catalogProduct.findFirst({
        where: {
          id: catalogProductId,
          organizationId
        }
      })

    if (!catalogProduct) {
      throw new Error('Catalog product not found')
    }

    const existingEventProduct = await prisma.eventProduct.findFirst({
      where: {
        eventId,
        catalogProductId,
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

    if (existingEventProduct) {
      return {
        eventProduct: {
          ...formatEventProduct(existingEventProduct),
          alreadyExists: true
        }
      }
    }

    const eventProduct =
      await prisma.eventProduct.create({
        data: {
          eventId,
          catalogProductId,
          priceInCents: priceInCents ?? null,
          active: active ?? true,
          trackStock: trackStock ?? false,
          stockQuantity: trackStock
            ? stockQuantity
            : null
        },
        include: {
          catalogProduct: {
            include: catalogProductInclude()
          }
        }
      })

    // Create audit log for event product created
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      eventId,
      userId,
      entity: 'EventProduct',
      entityId: eventProduct.id,
      action: AuditAction.EVENT_PRODUCT_CREATED,
      description: 'Produto adicionado ao evento',
      metadata: {
        eventProductId: eventProduct.id,
        catalogProductId,
        priceInCents
      }
    })

    return {
      eventProduct: {
        ...formatEventProduct(eventProduct),
        alreadyExists: false
      }
    }
  }
}
