import { FastifyReply, FastifyRequest } from 'fastify'

import { ListPaymentProviderSettingsService } from '../services/list-payment-provider-settings-service.js'

export async function listPaymentProviderSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const organizationId = request.user.organizationId

  const listPaymentProviderSettingsService =
    new ListPaymentProviderSettingsService()

  const { settings } =
    await listPaymentProviderSettingsService.execute({
      organizationId
    })

  return reply.status(200).send({
    settings
  })
}