import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface GetEventServiceRequest {
  eventId: string
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
}

export class GetEventService {
  async execute({ eventId, organizationId }: GetEventServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    return {
      event
    }
  }
}
