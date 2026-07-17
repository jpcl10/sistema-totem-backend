import { prisma } from '../../../lib/prisma.js'
import { GetEventClosingPreviewService } from './get-event-closing-preview-service.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface CloseEventServiceRequest {
  eventId: string
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  closedByUserId: string

  notes?: string | null
  allowPendingOrders: boolean
  allowPrintErrors: boolean
}

export class CloseEventService {
  async execute(request: CloseEventServiceRequest) {
    const existingEvent = await prisma.event.findFirst({
      where: {
        id: request.eventId,
        organizationId: request.organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true,
        closed: true,
        closedAt: true,
        organizationId: true,
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
        id: request.closedByUserId,
        organizationId: existingEvent.organizationId
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
      eventId: request.eventId,
      organizationId: existingEvent.organizationId,
      userRole: request.userRole
    })

    if (
      preview.summary.pendingOrders > 0 &&
      !request.allowPendingOrders
    ) {
      throw new Error(
        `Cannot close event with ${preview.summary.pendingOrders} pending orders`
      )
    }

    if (
      preview.printSummary.error > 0 &&
      !request.allowPrintErrors
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
              eventId: request.eventId
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
              eventId: request.eventId,
              organizationId: existingEvent.organizationId,
              closedByUserId: request.closedByUserId,

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

              notes: request.notes?.trim() || null,
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
              id: request.eventId
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

    // Audit log for event closed
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: existingEvent.organizationId,
      eventId: request.eventId,
      userId: request.closedByUserId,
      entity: 'Event',
      entityId: request.eventId,
      action: AuditAction.EVENT_CLOSED,
      description: 'Evento fechado',
      metadata: {
        eventId: request.eventId,
        totalOrders: preview.summary.totalOrders,
        receivedInCents: preview.summary.receivedInCents
      }
    })

    return {
      message: 'Event closed successfully',
      ...result,
      warningsAccepted: {
        pendingOrders:
          preview.summary.pendingOrders > 0 &&
          request.allowPendingOrders,

        printErrors:
          preview.printSummary.error > 0 &&
          request.allowPrintErrors
      }
    }
  }
}
