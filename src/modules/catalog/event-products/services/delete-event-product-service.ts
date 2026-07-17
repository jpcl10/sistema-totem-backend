import { prisma } from '../../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface DeleteEventProductServiceRequest {
  organizationId: string
  userId: string

  eventId: string

  eventProductId: string
}

export class DeleteEventProductService {
  async execute({
    organizationId,
    userId,
    eventId,
    eventProductId
  }: DeleteEventProductServiceRequest) {
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
        }
      })

    if (!eventProduct) {
      throw new Error('Event product not found')
    }

    await prisma.eventProduct.delete({
      where: {
        id: eventProductId
      }
    })

    // Create audit log for event product deleted
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      eventId,
      userId,
      entity: 'EventProduct',
      entityId: eventProductId,
      action: AuditAction.EVENT_PRODUCT_DELETED,
      description: 'Produto removido do evento',
      metadata: {
        eventProductId
      }
    })

    return {
      success: true
    }
  }
}
