import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { GetCheckoutPaymentSettingsService } from '../services/get-checkout-payment-settings-service.js'

const getCheckoutPaymentSettingsParamsSchema = z.object({
  eventId: z.string()
})

const getCheckoutPaymentSettingsQuerySchema = z.object({
  context: z.enum(['TOTEM', 'PUBLIC_CHECKOUT']).optional()
})

export async function getCheckoutPaymentSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    getCheckoutPaymentSettingsParamsSchema.parse(request.params)
  const { context } =
    getCheckoutPaymentSettingsQuerySchema.parse(request.query)

  const getCheckoutPaymentSettingsService =
    new GetCheckoutPaymentSettingsService()

  const { checkoutPaymentSettings } =
    await getCheckoutPaymentSettingsService.execute({
      eventId,
      context
    })

  return reply.status(200).send({
    checkoutPaymentSettings
  })
}
