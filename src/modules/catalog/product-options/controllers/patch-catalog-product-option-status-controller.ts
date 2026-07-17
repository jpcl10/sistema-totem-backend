import { FastifyReply, FastifyRequest } from 'fastify'
import { PatchCatalogProductOptionStatusService } from '../services/patch-catalog-product-option-status-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

export async function patchCatalogProductOptionStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { optionId: string }
  const body = request.body as { active: boolean }

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)
  const service = new PatchCatalogProductOptionStatusService()

  const { option } = await service.execute({
    organizationId,
    userRole: request.user.role,
    userId,
    optionId: params.optionId,
    active: body.active
  })

  return reply.status(200).send({
    option
  })
}
