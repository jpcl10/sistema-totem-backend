import { FastifyReply, FastifyRequest } from 'fastify'
import { getOnlineStoreParamsSchema } from '../schemas/get-online-store-schema.js'
import { GetOnlineStoreService } from '../services/get-online-store-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function getOnlineStoreController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = getOnlineStoreParamsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)
  const service = new GetOnlineStoreService()

  try {
    const result = await service.execute({
      id,
      organizationId,
      userRole: request.user.role
    })
    return reply.send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Store not found') {
      return reply.status(404).send({ message: 'Loja não encontrada' })
    }
    throw error
  }
}
