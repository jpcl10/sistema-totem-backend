import { FastifyReply, FastifyRequest } from 'fastify'
import { updateOnlineOrderStatusParamsSchema, updateOnlineOrderStatusSchema } from '../schemas/update-online-order-status-schema.js'
import { UpdateOnlineOrderStatusService } from '../services/update-online-order-status-service.js'
import { OnlineOrderStatus } from '@prisma/client'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { ZodError } from 'zod'

export async function updateOnlineOrderStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { orderId } = updateOnlineOrderStatusParamsSchema.parse(request.params)
    const { status } = updateOnlineOrderStatusSchema.parse(request.body)
    const organizationId = getTenantOrganizationId(request)
    const service = new UpdateOnlineOrderStatusService()

    const result = await service.execute({
      orderId,
      organizationId,
      userRole: request.user.role,
      status: status as OnlineOrderStatus
    })
    return reply.send(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: 'Invalid request',
        issues: error.issues
      })
    }

    if (error instanceof Error) {
      if (error.message === 'Order not found') {
        return reply.status(404).send({ message: 'Pedido não encontrado' })
      }
      if (error.message === 'Access denied') {
        return reply.status(403).send({ message: 'Acesso negado' })
      }
      if (error.message === 'Invalid status transition') {
        return reply.status(400).send({ message: 'Transi\u00e7\u00e3o de status inv\u00e1lida' })
      }
    }
    throw error
  }
}
