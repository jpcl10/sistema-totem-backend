import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { updateCatalogProductSchema } from '../schemas/update-catalog-product-schema.js'

import { UpdateCatalogProductService } from '../services/update-catalog-product-service.js'

export async function updateCatalogProductController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    id: string
  }

  const body =
    updateCatalogProductSchema.parse(
      request.body
    )

  const organizationId =
    request.user.organizationId

  const service =
    new UpdateCatalogProductService()

  const { product } =
    await service.execute({
      organizationId,

      productId: params.id,

      categoryId: body.categoryId,

      name: body.name,
      slug: body.slug,
      description: body.description,
      imageUrl: body.imageUrl,

      active: body.active
    })

  return reply.send({
    product
  })
}