import { FastifyReply, FastifyRequest } from 'fastify'

import { ListEventsService } from '../services/list-events-service.js'

export async function listEventsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const organizationId = request.user.organizationId

  const listEventsService = new ListEventsService()

  const { events } = await listEventsService.execute({
    organizationId
  })

  return reply.send({
    events
  })
}