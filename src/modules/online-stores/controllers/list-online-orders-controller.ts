import { FastifyReply, FastifyRequest } from 'fastify'
import { listOnlineOrdersParamsSchema } from '../schemas/list-online-orders-schema.js'
import { ListOnlineOrdersService } from '../services/list-online-orders-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function listOnlineOrdersController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { storeId } = listOnlineOrdersParamsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)
  const service = new ListOnlineOrdersService()

  try {
    const result = await service.execute({
      storeId,
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
