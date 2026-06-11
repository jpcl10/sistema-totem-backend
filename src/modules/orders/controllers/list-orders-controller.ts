import { FastifyReply, FastifyRequest } from 'fastify'

import { ListOrdersService } from '../services/list-orders-service.js'

export async function listOrdersController(
  request: FastifyRequest,
  reply: FastifyReply
) {

  const { eventId } = request.params as {
    eventId: string
  }

  const organizationId = request.user.organizationId

  const listOrdersService = new ListOrdersService()

  const { orders } = await listOrdersService.execute({
    organizationId,
    eventId
  })

  return reply.send({
    orders
  })
}