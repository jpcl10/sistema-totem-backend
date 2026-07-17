import { FastifyReply, FastifyRequest } from 'fastify'
import { ImportCatalogService } from '../services/import-catalog-service.js'
import { importCatalogSchema } from '../schemas/import-catalog-schema.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

export async function importCatalogController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = importCatalogSchema.parse(request.body)
  const organizationId = getTenantOrganizationId(request)

  const service = new ImportCatalogService()

  const result = await service.execute({
    organizationId,
    userRole: request.user.role,
    userId: request.user.sub,
    data: body
  })

  return reply.status(200).send(result)
}
