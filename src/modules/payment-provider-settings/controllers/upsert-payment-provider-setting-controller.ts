import { PaymentProvider } from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { UpsertPaymentProviderSettingService } from '../services/upsert-payment-provider-setting-service.js'

const upsertPaymentProviderSettingParamsSchema = z.object({
  provider: z.nativeEnum(PaymentProvider)
})

const upsertPaymentProviderSettingBodySchema = z.object({
  enabled: z.boolean().optional(),

  pixEnabled: z.boolean().optional(),
  cardEnabled: z.boolean().optional(),
  terminalEnabled: z.boolean().optional(),

  accessToken: z.string().nullable().optional(),
  publicKey: z.string().nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  webhookUrl: z.string().nullable().optional()
})

export async function upsertPaymentProviderSettingController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { provider } =
    upsertPaymentProviderSettingParamsSchema.parse(request.params)

  const {
    enabled,
    pixEnabled,
    cardEnabled,
    terminalEnabled,
    accessToken,
    publicKey,
    webhookSecret,
    webhookUrl
  } = upsertPaymentProviderSettingBodySchema.parse(request.body)

  const organizationId = request.user.organizationId

  const upsertPaymentProviderSettingService =
    new UpsertPaymentProviderSettingService()

  const { setting } =
    await upsertPaymentProviderSettingService.execute({
      organizationId,
      provider,
      enabled,
      pixEnabled,
      cardEnabled,
      terminalEnabled,
      accessToken,
      publicKey,
      webhookSecret,
      webhookUrl
    })

  return reply.status(200).send({
    setting
  })
}