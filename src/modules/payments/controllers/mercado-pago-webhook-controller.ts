import { FastifyReply, FastifyRequest } from 'fastify'

import { MercadoPagoWebhookService } from '../services/mercado-pago-webhook-service.js'

export async function mercadoPagoWebhookController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const mercadoPagoWebhookService =
    new MercadoPagoWebhookService()

  const result = await mercadoPagoWebhookService.execute({
    body: request.body,
    query: request.query,
    headers: request.headers
  })

  const validationFailures = [
    'webhook_secret_not_configured',
    'missing_x_signature',
    'missing_x_request_id',
    'missing_ts',
    'missing_v1',
    'invalid_signature'
  ]

  if (validationFailures.includes(result.reason || '')) {
    return reply.status(401).send(result)
  }

  return reply.status(200).send(result)
}