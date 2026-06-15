import { UserRole } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface DeleteEventServiceRequest {
  eventId: string
  organizationId: string
  userRole: UserRole
}

export class DeleteEventService {
  async execute({
    eventId,
    organizationId,
    userRole
  }: DeleteEventServiceRequest) {
    if (
      userRole !== UserRole.SUPER_ADMIN &&
      userRole !== UserRole.ADMIN
    ) {
      throw new Error(
        'User does not have permission to delete events'
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

        _count: {
          select: {
            orders: true,
            printJobs: true,
            eventProducts: true,
            printers: true
          }
        },

        closing: {
          select: {
            id: true
          }
        }
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const paymentTransactionsCount =
      await prisma.paymentTransaction.count({
        where: {
          order: {
            eventId: event.id
          }
        }
      })

    const hasOperationalData =
      event._count.orders > 0 ||
      event._count.printJobs > 0 ||
      paymentTransactionsCount > 0 ||
      Boolean(event.closing)

    if (hasOperationalData) {
      throw new Error(
        'Event cannot be deleted because it has operational data. Archive it instead.'
      )
    }

    await prisma.$transaction(async tx => {
      await tx.eventProduct.deleteMany({
        where: {
          eventId: event.id
        }
      })

      await tx.eventPrinter.deleteMany({
        where: {
          eventId: event.id
        }
      })

      await tx.event.delete({
        where: {
          id: event.id
        }
      })
    })

    return {
      message: 'Event deleted successfully',
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug
      }
    }
  }
}