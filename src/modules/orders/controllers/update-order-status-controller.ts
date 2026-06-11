import { FastifyReply, FastifyRequest } from 'fastify'

import { updateOrderStatusSchema } from '../schemas/update-order-status-schema.js'
import { UpdateOrderStatusService } from '../services/update-order-status-service.js'

export async function updateOrderStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as {
    id: string
  }

  const {
    status,
    cancelReason,
    restoreStock
  } = updateOrderStatusSchema.parse(request.body)

  const organizationId =
    request.user.organizationId

  const updateOrderStatusService =
    new UpdateOrderStatusService()

  const { order } =
    await updateOrderStatusService.execute({
      organizationId,
      orderId: id,
      status,
      cancelReason,
      restoreStock
    })

  return reply.send({
    order
  })
}