import { FastifyReply, FastifyRequest } from 'fastify'
import { GetEventService } from '../services/get-event-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function getEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as {
    id: string
  }
  const organizationId = getTenantOrganizationId(request)

  const getEventService = new GetEventService()

  const { event } = await getEventService.execute({
    eventId: id,
    organizationId,
    userRole: request.user.role
  })

  return reply.send({
    event
  })
}
