import { FastifyReply, FastifyRequest } from 'fastify'
import { identifyNfcCardSchema } from '../schemas/identify-nfc-card-schema.js'
import { IdentifyNfcCardService } from '../services/identify-nfc-card-service.js'

export async function identifyNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { eventSlug: string }
  const { uid } = identifyNfcCardSchema.parse(request.body)

  const service = new IdentifyNfcCardService()
  const result = await service.execute({ eventSlug: params.eventSlug, uid })

  return reply.status(200).send(result)
}
