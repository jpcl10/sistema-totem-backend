import { prisma } from '../../../lib/prisma.js'
import { GetEventClosingPreviewService } from './get-event-closing-preview-service.js'

interface CloseEventServiceRequest {
  eventId: string
  organizationId: string
  closedByUserId: string

  notes?: string | null
  allowPendingOrders: boolean
  allowPrintErrors: boolean
}

export class CloseEventService {
  async execute({
    eventId,
    organizationId,
    closedByUserId,
    notes,
    allowPendingOrders,
    allowPrintErrors
  }: CloseEventServiceRequest) {
    const existingEvent = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true,
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

    if (!existingEvent) {
      throw new Error('Event not found')
    }

    if (existingEvent.closed || existingEvent.closing) {
      throw new Error('Event already closed')
    }

    const user = await prisma.user.findFirst({
      where: {
        id: closedByUserId,
        organizationId
      },
      select: {
        id: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const previewService =
      new GetEventClosingPreviewService()

    const preview = await previewService.execute({
      eventId,
      organizationId
    })

    if (
      preview.summary.pendingOrders > 0 &&
      !allowPendingOrders
    ) {
      throw new Error(
        `Cannot close event with ${preview.summary.pendingOrders} pending orders`
      )
    }

    if (
      preview.printSummary.error > 0 &&
      !allowPrintErrors
    ) {
      throw new Error(
        `Cannot close event with ${preview.printSummary.error} print errors`
      )
    }

    const now = new Date()

    const result = await prisma.$transaction(
      async transaction => {
        const closingAlreadyExists =
          await transaction.eventClosing.findUnique({
            where: {
              eventId
            },
            select: {
              id: true
            }
          })

        if (closingAlreadyExists) {
          throw new Error('Event already closed')
        }

        const closing =
          await transaction.eventClosing.create({
            data: {
              eventId,
              organizationId,
              closedByUserId,

              totalOrders:
                preview.summary.totalOrders,

              paidOrders:
                preview.summary.paidOrders,

              pendingOrders:
                preview.summary.pendingOrders,

              cancelledOrders:
                preview.summary.cancelledOrders,

              receivedInCents:
                preview.summary.receivedInCents,

              pendingInCents:
                preview.summary.pendingInCents,

              cancelledInCents:
                preview.summary.cancelledInCents,

              averageTicketInCents:
                preview.summary.averageTicketInCents,

              pixManualInCents:
                preview.byPaymentMethod.PIX_MANUAL,

              pixAutomaticInCents:
                preview.byPaymentMethod.PIX_AUTOMATIC,

              cashInCents:
                preview.byPaymentMethod.CASH,

              creditCardInCents:
                preview.byPaymentMethod.CREDIT_CARD,

              debitCardInCents:
                preview.byPaymentMethod.DEBIT_CARD,

              courtesyInCents:
                preview.byPaymentMethod.COURTESY,

              otherInCents:
                preview.byPaymentMethod.OTHER,

              printPendingCount:
                preview.printSummary.pending,

              printPrintedCount:
                preview.printSummary.printed,

              printErrorCount:
                preview.printSummary.error,

              printCancelledCount:
                preview.printSummary.cancelled,

              notes: notes?.trim() || null,
              closedAt: now
            },
            include: {
              closedByUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true
                }
              }
            }
          })

        const event =
          await transaction.event.update({
            where: {
              id: eventId
            },
            data: {
              closed: true,
              closedAt: now,
              active: false
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

        return {
          event,
          closing
        }
      }
    )

    return {
      message: 'Event closed successfully',
      ...result,
      warningsAccepted: {
        pendingOrders:
          preview.summary.pendingOrders > 0 &&
          allowPendingOrders,

        printErrors:
          preview.printSummary.error > 0 &&
          allowPrintErrors
      }
    }
  }
}