import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { GetCheckoutPaymentSettingsService } from '../services/get-checkout-payment-settings-service.js'

const getCheckoutPaymentSettingsParamsSchema = z.object({
  eventId: z.string()
})

export async function getCheckoutPaymentSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    getCheckoutPaymentSettingsParamsSchema.parse(request.params)

  const getCheckoutPaymentSettingsService =
    new GetCheckoutPaymentSettingsService()

  const { checkoutPaymentSettings } =
    await getCheckoutPaymentSettingsService.execute({
      eventId
    })

  return reply.status(200).send({
    checkoutPaymentSettings
  })
}