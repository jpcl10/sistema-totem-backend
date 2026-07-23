import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { PreparePublicCheckoutPaymentService } from '../services/prepare-public-checkout-payment-service.js'

const preparePublicCheckoutPaymentParamsSchema = z.object({
  orderId: z.string()
})

const preparePublicCheckoutPaymentBodySchema = z.object({
  context: z.enum(['TOTEM', 'PUBLIC_CHECKOUT']).optional(),
  paymentMethod: z.enum(['PIX', 'CARD']).optional()
}).optional()

export async function preparePublicCheckoutPaymentController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } =
    preparePublicCheckoutPaymentParamsSchema.parse(request.params)
  const body =
    preparePublicCheckoutPaymentBodySchema.parse(request.body)

  const preparePublicCheckoutPaymentService =
    new PreparePublicCheckoutPaymentService()

  const result =
    await preparePublicCheckoutPaymentService.execute({
      orderId,
      context: body?.context,
      paymentMethod: body?.paymentMethod
    })

  return reply.status(200).send(result)
}
