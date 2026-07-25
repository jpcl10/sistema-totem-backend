import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import {
  GetPublicOnlineOrderPaymentStatusService,
  PublicOnlineOrderPaymentStatusNotFoundError
} from '../services/get-public-online-order-payment-status-service.js'

const paramsSchema = z.object({
  orderId: z.string()
})

export async function getPublicOnlineOrderPaymentStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } = paramsSchema.parse(request.params)
  const service = new GetPublicOnlineOrderPaymentStatusService()

  try {
    const status = await service.execute({ orderId })
    return reply.status(200).send(status)
  } catch (error) {
    if (error instanceof PublicOnlineOrderPaymentStatusNotFoundError) {
      return reply.status(404).send({
        message: 'Pedido nao encontrado'
      })
    }

    throw error
  }
}
