import { FastifyReply, FastifyRequest } from 'fastify'
import { PatchCatalogProductOptionGroupStatusService } from '../services/patch-catalog-product-option-group-status-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

export async function patchCatalogProductOptionGroupStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { groupId: string }
  const body = request.body as { active: boolean }

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)
  const service = new PatchCatalogProductOptionGroupStatusService()

  const { optionGroup } = await service.execute({
    organizationId,
    userRole: request.user.role,
    userId,
    groupId: params.groupId,
    active: body.active
  })

  return reply.status(200).send({
    optionGroup
  })
}
