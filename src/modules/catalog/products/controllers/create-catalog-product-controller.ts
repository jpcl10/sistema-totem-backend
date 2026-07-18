import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { createCatalogProductSchema } from '../schemas/create-catalog-product-schema.js'
import { CreateCatalogProductService } from '../services/create-catalog-product-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

export async function createCatalogProductController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body =
    createCatalogProductSchema.parse(
      request.body
    )

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)

  const service =
    new CreateCatalogProductService()

  const { product } =
    await service.execute({
      organizationId,
      userRole: request.user.role,
      userId,

      categoryId: body.categoryId,

      name: body.name,
      slug: body.slug,

      description: body.description,
      imageUrl: body.imageUrl,
      priceInCents: body.priceInCents,
      pricingRule: body.pricingRule,
      supportsHalfAndHalf: body.supportsHalfAndHalf,
      canBeUsedAsFlavor: body.canBeUsedAsFlavor,
      halfAndHalfFlavorCategoryId: body.halfAndHalfFlavorCategoryId,
      sortOrder: body.sortOrder
    })

  return reply.status(201).send({
    product
  })
}
