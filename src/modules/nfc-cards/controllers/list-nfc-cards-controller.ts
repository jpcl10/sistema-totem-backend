import { FastifyReply, FastifyRequest } from 'fastify'

import { listNfcCardsSchema } from '../schemas/list-nfc-cards-schema.js'
import { ListNfcCardsService } from '../services/list-nfc-cards-service.js'

export async function listNfcCardsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string }
  const querySchema = listNfcCardsSchema.parse(request.query)

  const service = new ListNfcCardsService()

  const result = await service.execute({
    organizationId: request.user.organizationId,
    eventId: paramsSchema.eventId,
    type: querySchema.type,
    status: querySchema.status
  })

  return reply.send(result)
}
