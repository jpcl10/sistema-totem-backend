import { prisma } from '../../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface CreateEventProductServiceRequest {
  organizationId: string
  userId: string

  eventId: string

  catalogProductId: string

  priceInCents: number
}

export class CreateEventProductService {
  async execute({
    organizationId,
    userId,
    eventId,
    catalogProductId,
    priceInCents
  }: CreateEventProductServiceRequest) {

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

    const eventProduct =
      await prisma.eventProduct.create({
        data: {
          eventId,
          catalogProductId,
          priceInCents
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
      eventProduct
    }
  }
}