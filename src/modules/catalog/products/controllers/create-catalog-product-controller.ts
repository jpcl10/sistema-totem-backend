import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { createCatalogProductSchema } from '../schemas/create-catalog-product-schema.js'

import { CreateCatalogProductService } from '../services/create-catalog-product-service.js'

export async function createCatalogProductController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body =
    createCatalogProductSchema.parse(
      request.body
    )

  const organizationId =
    request.user.organizationId

  const service =
    new CreateCatalogProductService()

  const { product } =
    await service.execute({
      organizationId,

      categoryId: body.categoryId,

      name: body.name,
      slug: body.slug,

      description: body.description,
      imageUrl: body.imageUrl
    })

  return reply.status(201).send({
    product
  })
}