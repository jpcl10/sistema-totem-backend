import { FastifyReply, FastifyRequest } from 'fastify'

import { GetEventService } from '../services/get-event-service.js'

export async function getEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as {
    id: string
  }

  const organizationId = request.user.organizationId

  const getEventService = new GetEventService()

  const { event } = await getEventService.execute({
    eventId: id,
    organizationId
  })

  return reply.send({
    event
  })
}