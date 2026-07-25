import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { ListStoreManualSaleCatalogService } from '../services/list-store-manual-sale-catalog-service.js'

const paramsSchema = z.object({
  storeId: z.string().min(1)
})

export async function listStoreManualSaleCatalogController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { storeId } = paramsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)

  try {
    const result = await new ListStoreManualSaleCatalogService().execute({
      organizationId,
      storeId
    })

    return reply.send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Store not found') {
      return reply.status(404).send({
        code: 'STORE_NOT_FOUND',
        message: 'Loja n\u00e3o encontrada.'
      })
    }

    throw error
  }
}
