import { AuditAction } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'

interface ListEventAuditLogsServiceRequest {
  organizationId: string
  eventId: string
  page?: number
  limit?: number
  action?: AuditAction
  entity?: string
  startDate?: string
  endDate?: string
}

export class ListEventAuditLogsService {
  async execute({
    organizationId,
    eventId,
    page = 1,
    limit = 50,
    action,
    entity,
    startDate,
    endDate
  }: ListEventAuditLogsServiceRequest) {
    // Verify event belongs to the organization
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      },
      select: { id: true }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    // Build where clause
    const whereClause: any = {
      organizationId,
      eventId
    }

    if (action) {
      whereClause.action = action
    }

    if (entity) {
      whereClause.entity = entity
    }

    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate)
      }
    }

    // Calculate skip
    const skip = (page - 1) * limit

    // Fetch audit logs with pagination
    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          device: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip
      }),
      prisma.auditLog.count({
        where: whereClause
      })
    ])

    const totalPages = Math.ceil(total / limit)

    return {
      auditLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }
  }
}
