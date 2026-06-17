import { FastifyReply, FastifyRequest } from 'fastify'

import { updateEventSchema } from '../schemas/update-event-schema.js'
import { UpdateEventService } from '../services/update-event-service.js'

export async function updateEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as {
    id: string
  }

  const organizationId = request.user.organizationId
  const userId = request.user.sub

  const data = updateEventSchema.parse(request.body)

  const updateEventService = new UpdateEventService()

  const { event } = await updateEventService.execute({
    eventId: id,
    organizationId,
    userId,
    ...data
  })

  return reply.send({
    event
  })
}