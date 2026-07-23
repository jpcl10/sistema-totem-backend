import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { CreateCatalogCategoryService } from '../services/create-catalog-category-service.js'
import { createCatalogCategorySchema } from '../schemas/create-catalog-category-schema.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { logCatalogTenantContext } from '../../shared/tenant-guard.js'

export async function createCatalogCategoryController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body =
    createCatalogCategorySchema.parse(
      request.body
    )
  const organizationId = getTenantOrganizationId(request)
  logCatalogTenantContext(request, 'POST /catalog/categories', organizationId)

  const service =
    new CreateCatalogCategoryService()

  const { category } =
    await service.execute({
      organizationId,
      userRole: request.user.role,

      name: body.name,
      slug: body.slug,

      sector: body.sector,
      sortOrder: body.sortOrder
    })

  return reply.status(201).send({
    category
  })
}
