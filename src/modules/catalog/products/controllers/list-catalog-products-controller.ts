import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { ListCatalogProductsService } from '../services/list-catalog-products-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { logCatalogTenantContext } from '../../shared/tenant-guard.js'

export async function listCatalogProductsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const organizationId = getTenantOrganizationId(request)
  logCatalogTenantContext(request, 'GET /catalog/products', organizationId)

  const service =
    new ListCatalogProductsService()

  const { products } =
    await service.execute({
      organizationId,
      userRole: request.user.role
    })

  return reply.send({
    products
  })
}
