import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { CreateCatalogCategoryService } from '../services/create-catalog-category-service.js'

import { createCatalogCategorySchema } from '../schemas/create-catalog-category-schema.js'

export async function createCatalogCategoryController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body =
    createCatalogCategorySchema.parse(
      request.body
    )

  const organizationId =
    request.user.organizationId

  const service =
    new CreateCatalogCategoryService()

  const { category } =
    await service.execute({
      organizationId,

      name: body.name,
      slug: body.slug,

      sector: body.sector
    })

  return reply.status(201).send({
    category
  })
}