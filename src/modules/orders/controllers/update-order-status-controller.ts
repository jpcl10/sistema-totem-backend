import { FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
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

  try {
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
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'INVALID_ORDER_STATUS',
        message: 'Status de pedido inválido.',
        allowedStatuses: [
          'CONFIRMED',
          'PREPARING',
          'READY',
          'DELIVERED',
          'CANCELLED'
        ],
        issues: error.issues
      })
    }

    throw error
  }
}
