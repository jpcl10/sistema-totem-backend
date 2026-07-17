import { FastifyReply, FastifyRequest } from 'fastify'
import { createCatalogProductOptionGroupSchema } from '../schemas/create-catalog-product-option-group-schema.js'
import { CreateCatalogProductOptionGroupService } from '../services/create-catalog-product-option-group-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

export async function createCatalogProductOptionGroupController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { productId: string }
  const body = createCatalogProductOptionGroupSchema.parse(request.body)

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)
  const service = new CreateCatalogProductOptionGroupService()

  const { optionGroup } = await service.execute({
    organizationId,
    userRole: request.user.role,
    userId,
    productId: params.productId,
    name: body.name,
    key: body.key,
    description: body.description,
    required: body.required,
    minSelections: body.minSelections,
    maxSelections: body.maxSelections,
    sortOrder: body.sortOrder
  })

  return reply.status(201).send({
    optionGroup
  })
}
