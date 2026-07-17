import { FastifyReply, FastifyRequest } from 'fastify'
import { updateCatalogProductOptionGroupSchema } from '../schemas/update-catalog-product-option-group-schema.js'
import { UpdateCatalogProductOptionGroupService } from '../services/update-catalog-product-option-group-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

export async function updateCatalogProductOptionGroupController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { groupId: string }
  const body = updateCatalogProductOptionGroupSchema.parse(request.body)

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)
  const service = new UpdateCatalogProductOptionGroupService()

  const { optionGroup } = await service.execute({
    organizationId,
    userRole: request.user.role,
    userId,
    groupId: params.groupId,
    name: body.name,
    key: body.key,
    description: body.description,
    required: body.required,
    minSelections: body.minSelections,
    maxSelections: body.maxSelections,
    sortOrder: body.sortOrder
  })

  return reply.status(200).send({
    optionGroup
  })
}
