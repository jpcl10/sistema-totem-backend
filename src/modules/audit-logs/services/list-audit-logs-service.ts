import { AuditAction, Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'

interface ListAuditLogsServiceRequest {
  organizationId: string
  page?: number
  limit?: number
  action?: AuditAction
  entity?: string
  entityType?: string
  entityId?: string
  actorUserId?: string
  userId?: string
  deviceId?: string
  eventId?: string
  dateFrom?: string
  dateTo?: string
  startDate?: string
  endDate?: string
}

export class ListAuditLogsService {
  async execute({
    organizationId,
    page = 1,
    limit = 50,
    action,
    entity,
    entityType,
    entityId,
    actorUserId,
    userId,
    deviceId,
    eventId,
    dateFrom,
    dateTo,
    startDate,
    endDate
  }: ListAuditLogsServiceRequest) {
    const whereClause: Prisma.AuditLogWhereInput = {
      organizationId
    }

    if (action) {
      whereClause.action = action
    }

    const resolvedEntity = entityType ?? entity
    if (resolvedEntity) {
      whereClause.entity = resolvedEntity
    }

    if (entityId) {
      whereClause.entityId = entityId
    }

    const resolvedUserId = actorUserId ?? userId
    if (resolvedUserId) {
      whereClause.userId = resolvedUserId
    }

    if (deviceId) {
      whereClause.deviceId = deviceId
    }

    if (eventId) {
      whereClause.eventId = eventId
    }

    const resolvedDateFrom = dateFrom ?? startDate
    const resolvedDateTo = dateTo ?? endDate
    if (resolvedDateFrom || resolvedDateTo) {
      whereClause.createdAt = {}
      if (resolvedDateFrom) {
        whereClause.createdAt.gte = new Date(resolvedDateFrom)
      }
      if (resolvedDateTo) {
        whereClause.createdAt.lte = new Date(resolvedDateTo)
      }
    }

    const skip = (page - 1) * limit

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

    return {
      auditLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }
}
