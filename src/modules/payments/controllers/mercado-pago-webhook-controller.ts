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

  return reply.status(200).send(result)
}