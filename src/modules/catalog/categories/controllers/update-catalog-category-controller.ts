import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { updateCatalogCategorySchema } from '../schemas/update-catalog-category-schema.js'
import { UpdateCatalogCategoryService } from '../services/update-catalog-category-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { logCatalogTenantContext } from '../../shared/tenant-guard.js'

export async function updateCatalogCategoryController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    id: string
  }

  const body =
    updateCatalogCategorySchema.parse(
      request.body
    )
  const organizationId = getTenantOrganizationId(request)
  logCatalogTenantContext(request, 'PUT /catalog/categories/:id', organizationId)

  const service =
    new UpdateCatalogCategoryService()

  const { category } =
    await service.execute({
      organizationId,
      userRole: request.user.role,

      categoryId: params.id,

      name: body.name,
      slug: body.slug,
      sector: body.sector,
      active: body.active,
      sortOrder: body.sortOrder
    })

  return reply.send({
    category
  })
}
