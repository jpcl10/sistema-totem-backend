import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { logCatalogTenantContext } from '../../shared/tenant-guard.js'
import { DeleteCatalogProductService } from '../services/delete-catalog-product-service.js'

export async function deleteCatalogProductController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { id: string }
  const organizationId = getTenantOrganizationId(request)
  logCatalogTenantContext(request, 'DELETE /catalog/products/:id', organizationId)

  const result = await new DeleteCatalogProductService().execute({
    organizationId,
    userId: request.user.sub,
    userRole: request.user.role,
    productId: params.id
  })

  return reply.send(result)
}
