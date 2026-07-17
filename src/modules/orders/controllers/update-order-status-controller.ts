import { FastifyReply, FastifyRequest } from 'fastify'
import { updateOrderStatusSchema } from '../schemas/update-order-status-schema.js'
import { UpdateOrderStatusService } from '../services/update-order-status-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

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
  const organizationId = getTenantOrganizationId(request)

  const updateOrderStatusService =
    new UpdateOrderStatusService()

  const { order } =
    await updateOrderStatusService.execute({
      organizationId,
      userRole: request.user.role,
      orderId: id,
      status,
      cancelReason,
      restoreStock
    })

  return reply.send({
    order
  })
}
