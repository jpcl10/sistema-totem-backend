import {
  PaymentMethod,
  PaymentProvider
} from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import {
  CardPaymentIntentService,
  CardPaymentResult
} from '../services/card-payment-intent-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const createCardPaymentIntentBodySchema = z.object({
  orderId: z.string().optional(),
  onlineOrderId: z.string().optional(),
  terminalId: z.string().optional(),
  provider: z.nativeEnum(PaymentProvider),
  method: z.enum([
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.DEBIT_CARD
  ]),
  amountInCents: z.number().int().positive(),
  installments: z.number().int().positive().max(24).optional(),
  idempotencyKey: z.string().trim().min(1).optional()
})

const confirmCardPaymentIntentParamsSchema = z.object({
  paymentTransactionId: z.string()
})

const forbiddenCardDataSchema = z.object({
  pan: z.never().optional(),
  cardNumber: z.never().optional(),
  cvv: z.never().optional(),
  trackData: z.never().optional(),
  track1: z.never().optional(),
  track2: z.never().optional()
})

const confirmCardPaymentIntentBodySchema =
  forbiddenCardDataSchema.and(z.object({
    result: z.enum([
      'APPROVED',
      'DECLINED',
      'CANCELLED',
      'ERROR',
      'PENDING'
    ]),
    amountInCents: z.number().int().positive(),
    providerTransactionId: z.string().nullable().optional(),
    authorizationCode: z.string().nullable().optional(),
    nsu: z.string().nullable().optional(),
    brand: z.string().nullable().optional(),
    installments: z.number().int().positive().max(24).nullable().optional(),
    gatewayMessage: z.string().nullable().optional()
  }))

function mapControllerError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof Error)) {
    return reply.status(500).send({ message: 'Internal server error' })
  }

  if (
    error.message.includes('not found') ||
    error.message.includes('Order context')
  ) {
    return reply.status(404).send({ message: error.message })
  }

  if (
    error.message.includes('does not match') ||
    error.message.includes('already confirmed') ||
    error.message.includes('Only one')
  ) {
    return reply.status(409).send({ message: error.message })
  }

  return reply.status(400).send({ message: error.message })
}

export async function createCardPaymentIntentController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const body = createCardPaymentIntentBodySchema.parse(request.body)
    const service = new CardPaymentIntentService()

    const result = await service.create({
      organizationId,
      orderId: body.orderId,
      onlineOrderId: body.onlineOrderId,
      terminalId: body.terminalId,
      provider: body.provider,
      method: body.method,
      amountInCents: body.amountInCents,
      installments: body.installments,
      idempotencyKey: body.idempotencyKey
    })

    return reply.status(201).send(result)
  } catch (error) {
    return mapControllerError(reply, error)
  }
}

export async function confirmCardPaymentIntentController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { paymentTransactionId } =
      confirmCardPaymentIntentParamsSchema.parse(request.params)
    const body = confirmCardPaymentIntentBodySchema.parse(request.body)
    const service = new CardPaymentIntentService()

    const result = await service.confirm({
      organizationId: request.device.organizationId,
      deviceId: request.device.deviceId,
      paymentTransactionId,
      result: body.result as CardPaymentResult,
      amountInCents: body.amountInCents,
      providerTransactionId: body.providerTransactionId,
      authorizationCode: body.authorizationCode,
      nsu: body.nsu,
      brand: body.brand,
      installments: body.installments,
      gatewayMessage: body.gatewayMessage
    })

    return reply.send(result)
  } catch (error) {
    return mapControllerError(reply, error)
  }
}
