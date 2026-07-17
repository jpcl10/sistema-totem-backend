import { FastifyReply, FastifyRequest } from 'fastify'
import { createCatalogProductOptionSchema } from '../schemas/create-catalog-product-option-schema.js'
import { CreateCatalogProductOptionService } from '../services/create-catalog-product-option-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

export async function createCatalogProductOptionController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { groupId: string }
  const body = createCatalogProductOptionSchema.parse(request.body)

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)
  const service = new CreateCatalogProductOptionService()

  const { option } = await service.execute({
    organizationId,
    userRole: request.user.role,
    userId,
    groupId: params.groupId,
    name: body.name,
    key: body.key,
    description: body.description,
    priceDeltaInCents: body.priceDeltaInCents,
    linkedProductId: body.linkedProductId,
    sortOrder: body.sortOrder
  })

  return reply.status(201).send({
    option
  })
}
