import { UserRole } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface ArchiveEventServiceRequest {
  eventId: string
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
}

export class ArchiveEventService {
  async execute({
    eventId,
    organizationId,
    userRole
  }: ArchiveEventServiceRequest) {
    if (
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.ADMIN
    ) {
      throw new Error(
        'User does not have permission to archive events'
      )
    }

    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        closed: true,
        closedAt: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    if (event.closed) {
      throw new Error(
        'Closed events are already inactive and cannot be archived'
      )
    }

    if (!event.active) {
      throw new Error('Event is already archived')
    }

    const archivedEvent = await prisma.event.update({
      where: {
        id: event.id
      },
      data: {
        active: false
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        slug: true,
        active: true,
        closed: true,
        closedAt: true,
        updatedAt: true
      }
    })

    return {
      message: 'Event archived successfully',
      event: archivedEvent
    }
  }
}
