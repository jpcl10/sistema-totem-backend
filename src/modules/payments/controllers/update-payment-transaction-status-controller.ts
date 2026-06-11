import {
  PaymentTransactionStatus,
  Prisma
} from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { UpdatePaymentTransactionStatusService } from '../services/update-payment-transaction-status-service.js'

const updatePaymentTransactionStatusParamsSchema = z.object({
  paymentTransactionId: z.string()
})

const updatePaymentTransactionStatusBodySchema = z.object({
  status: z.nativeEnum(PaymentTransactionStatus),
  gatewayStatus: z
    .string()
    .nullable()
    .optional(),
  gatewayMessage: z
    .string()
    .nullable()
    .optional(),
  errorMessage: z
    .string()
    .nullable()
    .optional(),
  metadata: z
    .unknown()
    .nullable()
    .optional()
})

export async function updatePaymentTransactionStatusController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { paymentTransactionId } =
    updatePaymentTransactionStatusParamsSchema.parse(request.params)

  const {
    status,
    gatewayStatus,
    gatewayMessage,
    errorMessage,
    metadata
  } = updatePaymentTransactionStatusBodySchema.parse(request.body)

  const organizationId =
    request.user.organizationId

  const updatePaymentTransactionStatusService =
    new UpdatePaymentTransactionStatusService()

  const {
    paymentTransaction,
    order
  } = await updatePaymentTransactionStatusService.execute({
    organizationId,
    paymentTransactionId,
    status,
    gatewayStatus,
    gatewayMessage,
    errorMessage,
    metadata: metadata as Prisma.InputJsonValue | null | undefined
  })

  return reply.status(200).send({
    paymentTransaction,
    order
  })
}