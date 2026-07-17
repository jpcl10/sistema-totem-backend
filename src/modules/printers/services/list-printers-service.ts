import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface ListPrintersServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  eventId: string
}

export class ListPrintersService {
  async execute({
    organizationId,
    eventId
  }: ListPrintersServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const printers = await prisma.eventPrinter.findMany({
      where: {
        eventId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      printers
    }
  }
}
