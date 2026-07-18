import { FastifyReply, FastifyRequest } from 'fastify'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { listAuditLogsQuerySchema } from '../schemas/list-audit-logs-schema.js'
import { ListAuditLogsService } from '../services/list-audit-logs-service.js'

export async function listAuditLogsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = listAuditLogsQuerySchema.parse(request.query)
  const service = new ListAuditLogsService()
  const organizationId = getTenantOrganizationId(request)

  const { auditLogs, pagination } = await service.execute({
    organizationId,
    page: query.page,
    limit: query.limit,
    action: query.action,
    entity: query.entity,
    entityType: query.entityType,
    entityId: query.entityId,
    actorUserId: query.actorUserId,
    userId: query.userId,
    deviceId: query.deviceId,
    eventId: query.eventId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    startDate: query.startDate,
    endDate: query.endDate
  })

  return reply.status(200).send({ auditLogs, pagination })
}
