import {
  PaymentMethod,
  PaymentProvider,
  Prisma
} from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { CreatePaymentTransactionService } from '../services/create-payment-transaction-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const createPaymentTransactionParamsSchema = z.object({
  orderId: z.string()
})

const createPaymentTransactionBodySchema = z.object({
  provider: z.nativeEnum(PaymentProvider),
  method: z.nativeEnum(PaymentMethod).nullable().optional(),
  amountInCents: z.number().int().positive().nullable().optional(),
  externalReference: z.string().nullable().optional(),
  gatewayStatus: z.string().nullable().optional(),
  gatewayMessage: z.string().nullable().optional(),
  metadata: z.unknown().nullable().optional()
})

export async function createPaymentTransactionController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { orderId } =
    createPaymentTransactionParamsSchema.parse(request.params)

  const {
    provider,
    method,
    amountInCents,
    externalReference,
    gatewayStatus,
    gatewayMessage,
    metadata
  } = createPaymentTransactionBodySchema.parse(request.body)

  const organizationId = getTenantOrganizationId(request)

  const createPaymentTransactionService =
    new CreatePaymentTransactionService()

  const { paymentTransaction } =
    await createPaymentTransactionService.execute({
      organizationId,
      orderId,
      provider,
      method,
      amountInCents,
      externalReference,
      gatewayStatus,
      gatewayMessage,
      metadata: metadata as Prisma.InputJsonValue | null | undefined
    })

  return reply.status(201).send({
    paymentTransaction
  })
}
