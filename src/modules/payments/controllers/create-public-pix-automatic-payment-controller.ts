import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { CreatePublicPixAutomaticPaymentService } from '../services/create-public-pix-automatic-payment-service.js'

const createPublicPixAutomaticPaymentParamsSchema = z.object({
  orderId: z.string()
})

export async function createPublicPixAutomaticPaymentController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } =
    createPublicPixAutomaticPaymentParamsSchema.parse(request.params)

  const createPublicPixAutomaticPaymentService =
    new CreatePublicPixAutomaticPaymentService()

  const { paymentTransaction } =
    await createPublicPixAutomaticPaymentService.execute({
      orderId
    })

  return reply.status(201).send({
    paymentTransaction
  })
}