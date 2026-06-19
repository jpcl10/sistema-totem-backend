import { FastifyReply, FastifyRequest } from 'fastify'

import { BlockNfcCardService } from '../services/block-nfc-card-service.js'

export async function blockNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string; id: string }

  const service = new BlockNfcCardService()

  const result = await service.execute({
    organizationId: request.user.organizationId,
    userId: request.user.sub,
    eventId: paramsSchema.eventId,
    nfcCardId: paramsSchema.id
  })

  return reply.send(result)
}
