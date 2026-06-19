import { FastifyReply, FastifyRequest } from 'fastify'

import { GetNfcCardByUidService } from '../services/get-nfc-card-by-uid-service.js'

export async function getNfcCardByUidController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string; uid: string }

  const service = new GetNfcCardByUidService()

  const result = await service.execute({
    organizationId: request.user.organizationId,
    userId: request.user.sub,
    eventId: paramsSchema.eventId,
    uid: paramsSchema.uid
  })

  return reply.send(result)
}
