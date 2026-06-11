import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { ListCatalogProductsService } from '../services/list-catalog-products-service.js'

export async function listCatalogProductsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const organizationId =
    request.user.organizationId

  const service =
    new ListCatalogProductsService()

  const { products } =
    await service.execute({
      organizationId
    })

  return reply.send({
    products
  })
}