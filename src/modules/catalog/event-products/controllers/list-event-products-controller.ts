import {FastifyReply,FastifyRequest} from 'fastify'

import { ListEventProductsService } from '../services/list-event-products-service.js'

export async function listEventProductsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    eventId: string
  }

  const organizationId =
    request.user.organizationId

  const service =
    new ListEventProductsService()

  const { eventProducts } =
    await service.execute({
      organizationId,
      eventId: params.eventId
    })

  return reply.send({
    eventProducts
  })
}