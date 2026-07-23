import { FastifyReply, FastifyRequest } from 'fastify'
import { ListCatalogCategoriesService } from '../services/list-catalog-categories-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { logCatalogTenantContext } from '../../shared/tenant-guard.js'

export async function listCatalogCategoriesController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const organizationId = getTenantOrganizationId(request)
  logCatalogTenantContext(request, 'GET /catalog/categories', organizationId)

  const service =
    new ListCatalogCategoriesService()

  const { categories } =
    await service.execute({
      organizationId,
      userRole: request.user.role
    })

  return reply.send({
    categories
  })
}
