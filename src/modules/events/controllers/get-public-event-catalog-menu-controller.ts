import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { GetPublicEventCatalogMenuService } from '../services/get-public-event-catalog-menu-service.js'

export async function getPublicEventCatalogMenuController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    slug: string
  }

  const service =
    new GetPublicEventCatalogMenuService()

  const { event } =
    await service.execute({
      slug: params.slug
    })

  return reply.send({
    event
  })
}