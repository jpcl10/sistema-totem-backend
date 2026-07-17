import { FastifyReply, FastifyRequest } from 'fastify'
import { ListEventsService } from '../services/list-events-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function listEventsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const organizationId = getTenantOrganizationId(request)
  const listEventsService = new ListEventsService()

  const { events } = await listEventsService.execute({
    organizationId,
    userRole: request.user.role
  })

  return reply.send({
    events
  })
}
