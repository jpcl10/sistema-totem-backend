import { FastifyReply, FastifyRequest } from 'fastify'

import { updateNfcCardSchema } from '../schemas/update-nfc-card-schema.js'
import { UpdateNfcCardService } from '../services/update-nfc-card-service.js'

export async function updateNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string; id: string }

  const {
    code,
    holderName,
    type,
    status,
    metadata
  } = updateNfcCardSchema.parse(request.body)

  const service = new UpdateNfcCardService()

  const result = await service.execute({
    organizationId: request.user.organizationId,
    userId: request.user.sub,
    eventId: paramsSchema.eventId,
    nfcCardId: paramsSchema.id,
    code,
    holderName,
    type,
    status,
    metadata
  })

  return reply.send(result)
}
