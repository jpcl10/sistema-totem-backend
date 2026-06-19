import { FastifyReply, FastifyRequest } from 'fastify'

import { readNfcCardSchema } from '../schemas/read-nfc-card-schema.js'
import { ReadNfcCardService } from '../services/read-nfc-card-service.js'

export async function readNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string }

  const { uid } = readNfcCardSchema.parse(request.body)

  const service = new ReadNfcCardService()

  const result = await service.execute({
    organizationId: request.user.organizationId,
    userId: request.user.sub,
    eventId: paramsSchema.eventId,
    uid
  })

  return reply.status(200).send(result)
}
