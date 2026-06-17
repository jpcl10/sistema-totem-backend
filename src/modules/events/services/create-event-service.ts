import { prisma } from '../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface CreateEventServiceRequest {
  organizationId: string
  userId: string
  name: string
  slug: string
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  startsAt?: Date
  endsAt?: Date
}

export class CreateEventService {
  async execute({
    organizationId,
    userId,
    name,
    slug,
    primaryColor,
    secondaryColor,
    logoUrl,
    startsAt,
    endsAt
  }: CreateEventServiceRequest) {
    const eventWithSameSlug = await prisma.event.findFirst({
      where: {
        organizationId,
        slug
      }
    })

    if (eventWithSameSlug) {
      throw new Error('Event already exists')
    }

    const event = await prisma.event.create({
      data: {
        organizationId,
        name,
        slug,
        primaryColor,
        secondaryColor,
        logoUrl,
        startsAt,
        endsAt
      }
    })

    // Create audit log for event created
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      userId,
      eventId: event.id,
      entity: 'Event',
      entityId: event.id,
      action: AuditAction.EVENT_CREATED,
      description: 'Evento criado',
      metadata: {
        eventId: event.id,
        name: event.name,
        slug: event.slug,
        active: event.active,
        organizationId
      }
    })

    return {
      event
    }
  }
}