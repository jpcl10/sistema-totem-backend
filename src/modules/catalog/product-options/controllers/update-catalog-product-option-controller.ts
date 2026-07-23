import { FastifyReply, FastifyRequest } from 'fastify'
import { updateCatalogProductOptionSchema } from '../schemas/update-catalog-product-option-schema.js'
import { UpdateCatalogProductOptionService } from '../services/update-catalog-product-option-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { logCatalogTenantContext } from '../../shared/tenant-guard.js'

export async function updateCatalogProductOptionController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { optionId: string }
  const body = updateCatalogProductOptionSchema.parse(request.body)

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)
  logCatalogTenantContext(request, 'PUT /catalog/options/:optionId', organizationId)
  const service = new UpdateCatalogProductOptionService()

  const { option } = await service.execute({
    organizationId,
    userRole: request.user.role,
    userId,
    optionId: params.optionId,
    name: body.name,
    key: body.key,
    description: body.description,
    priceDeltaInCents: body.priceDeltaInCents,
    linkedProductId: body.linkedProductId,
    sortOrder: body.sortOrder
  })

  return reply.status(200).send({
    option
  })
}
