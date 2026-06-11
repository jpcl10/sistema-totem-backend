import { FastifyReply, FastifyRequest } from 'fastify'

import { GetPublicEventMenuService } from '../services/get-public-event-menu-service.js'

export async function getPublicEventMenuController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { slug } = request.params as {
    slug: string
  }

  const getPublicEventMenuService = new GetPublicEventMenuService()

  const { event } = await getPublicEventMenuService.execute({
    slug
  })

  return reply.send({
    event
  })
}