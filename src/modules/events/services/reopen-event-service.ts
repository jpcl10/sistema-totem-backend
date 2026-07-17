import { UserRole } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface ReopenEventServiceRequest {
  eventId: string
  organizationId: string
  userId: string
  userRole: UserRole
  selectedOrganizationId?: string
}

export class ReopenEventService {
  async execute({
    eventId,
    organizationId,
    userId,
    userRole
  }: ReopenEventServiceRequest) {
    if (
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.ADMIN
    ) {
      throw new Error('User does not have permission to reopen events')
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
        closedAt: true,
        closing: {
          select: {
            id: true,
            closedAt: true
          }
        }
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    if (!event.closed && !event.closing) {
      throw new Error('Event is already open')
    }

    const result = await prisma.$transaction(async tx => {
      if (event.closing) {
        await tx.eventClosing.delete({
          where: {
            eventId
          }
        })
      }

      const reopenedEvent = await tx.event.update({
        where: {
          id: eventId
        },
        data: {
          active: true,
          closed: false,
          closedAt: null
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

      return reopenedEvent
    })

    return {
      message: 'Event reopened successfully',
      reopenedByUserId: userId,
      event: result
    }
  }
}
