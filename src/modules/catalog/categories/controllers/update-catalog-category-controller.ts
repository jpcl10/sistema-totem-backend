import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { updateCatalogCategorySchema } from '../schemas/update-catalog-category-schema.js'

import { UpdateCatalogCategoryService } from '../services/update-catalog-category-service.js'

export async function updateCatalogCategoryController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    id: string
  }

  const body =
    updateCatalogCategorySchema.parse(
      request.body
    )

  const organizationId =
    request.user.organizationId

  const service =
    new UpdateCatalogCategoryService()

  const { category } =
    await service.execute({
      organizationId,

      categoryId: params.id,

      name: body.name,
      slug: body.slug,
      sector: body.sector,
      active: body.active
    })

  return reply.send({
    category
  })
}