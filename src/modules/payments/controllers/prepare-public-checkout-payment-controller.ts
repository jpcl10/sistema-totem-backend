import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { PreparePublicCheckoutPaymentService } from '../services/prepare-public-checkout-payment-service.js'

const preparePublicCheckoutPaymentParamsSchema = z.object({
  orderId: z.string()
})

export async function preparePublicCheckoutPaymentController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } =
    preparePublicCheckoutPaymentParamsSchema.parse(request.params)

  const preparePublicCheckoutPaymentService =
    new PreparePublicCheckoutPaymentService()

  const result =
    await preparePublicCheckoutPaymentService.execute({
      orderId
    })

  return reply.status(200).send(result)
}