import {
  PaymentMethod,
  PaymentStatus
} from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { MarkOrderPaymentService } from '../services/mark-order-payment-service.js'

const markOrderPaymentParamsSchema = z.object({
  orderId: z.string()
})

const markOrderPaymentBodySchema = z.object({
  paymentStatus: z.nativeEnum(PaymentStatus),
  paymentMethod: z
    .nativeEnum(PaymentMethod)
    .nullable()
    .optional(),
  amountPaidInCents: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional(),
  changeForInCents: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional(),
  paymentNotes: z
    .string()
    .nullable()
    .optional()
})

export async function markOrderPaymentController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } =
    markOrderPaymentParamsSchema.parse(request.params)

  const {
    paymentStatus,
    paymentMethod,
    amountPaidInCents,
    changeForInCents,
    paymentNotes
  } = markOrderPaymentBodySchema.parse(request.body)

  const organizationId =
    request.user.organizationId

  const markOrderPaymentService =
    new MarkOrderPaymentService()

  const { order } =
    await markOrderPaymentService.execute({
      organizationId,
      orderId,
      paymentStatus,
      paymentMethod,
      amountPaidInCents,
      changeForInCents,
      paymentNotes
    })

  return reply.status(200).send({
    order
  })
}