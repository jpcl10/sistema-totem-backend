import { FastifyReply, FastifyRequest } from 'fastify'

import {
  listEventAuditLogsParamsSchema,
  listEventAuditLogsQuerySchema
} from '../schemas/list-event-audit-logs-schema.js'
import { ListEventAuditLogsService } from '../services/list-event-audit-logs-service.js'

export async function listEventAuditLogsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = listEventAuditLogsParamsSchema.parse(request.params)
  const { page, limit, action, entity, userId, deviceId, startDate, endDate } =
    listEventAuditLogsQuerySchema.parse(request.query)

  const organizationId = request.user.organizationId

  const service = new ListEventAuditLogsService()
  const { auditLogs, pagination } = await service.execute({
    organizationId,
    eventId,
    page,
    limit,
    action,
    entity,
    userId,
    deviceId,
    startDate,
    endDate
  })

  return reply.status(200).send({ auditLogs, pagination })
}
