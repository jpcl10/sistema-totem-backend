import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { updateCatalogProductSchema } from '../schemas/update-catalog-product-schema.js'
import { UpdateCatalogProductService } from '../services/update-catalog-product-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

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

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)

  const service =
    new UpdateCatalogProductService()

  const { product } =
    await service.execute({
      organizationId,
      userRole: request.user.role,
      userId,

      productId: params.id,

      categoryId: body.categoryId,

      name: body.name,
      slug: body.slug,
      description: body.description,
      imageUrl: body.imageUrl,

      active: body.active,
      priceInCents: body.priceInCents,
      sortOrder: body.sortOrder
    })

  return reply.send({
    product
  })
}
