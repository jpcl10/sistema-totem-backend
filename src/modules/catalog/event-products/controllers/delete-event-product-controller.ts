import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { DeleteEventProductService } from '../services/delete-event-product-service.js'

export async function deleteEventProductController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    eventId: string
    eventProductId: string
  }

  const organizationId =
    request.user.organizationId

  const service =
    new DeleteEventProductService()

  await service.execute({
    organizationId,

    eventId: params.eventId,

    eventProductId:
      params.eventProductId
  })

  return reply.status(204).send()
}