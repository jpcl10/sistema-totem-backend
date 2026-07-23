import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { logCatalogTenantContext } from '../../shared/tenant-guard.js'
import { DeleteCatalogCategoryService } from '../services/delete-catalog-category-service.js'

export async function deleteCatalogCategoryController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { id: string }
  const organizationId = getTenantOrganizationId(request)
  logCatalogTenantContext(request, 'DELETE /catalog/categories/:id', organizationId)

  const { action, categoryId, message } =
    await new DeleteCatalogCategoryService().execute({
      organizationId,
      userId: request.user.sub,
      userRole: request.user.role,
      categoryId: params.id
    })

  return reply.send({
    code: 'CATEGORY_DELETED',
    action,
    categoryId,
    message
  })
}
