import { FastifyReply, FastifyRequest } from 'fastify'

import { ListCatalogCategoriesService } from '../services/list-catalog-categories-service.js'

export async function listCatalogCategoriesController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const organizationId =
    request.user.organizationId

  const service =
    new ListCatalogCategoriesService()

  const { categories } =
    await service.execute({
      organizationId
    })

  return reply.send({
    categories
  })
}