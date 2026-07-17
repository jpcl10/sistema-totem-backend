import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface ListEventsServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
}

export class ListEventsService {
  async execute({
    organizationId
  }: ListEventsServiceRequest) {
    const events = await prisma.event.findMany({
      where: {
        organizationId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      events
    }
  }
}
