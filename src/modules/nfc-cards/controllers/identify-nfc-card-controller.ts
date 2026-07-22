import { FastifyReply, FastifyRequest } from 'fastify'
import { identifyNfcCardSchema } from '../schemas/identify-nfc-card-schema.js'
import { IdentifyNfcCardService } from '../services/identify-nfc-card-service.js'
import {
  AmbiguousEventSlugError,
  buildAmbiguousEventSlugResponse
} from '../../events/services/public-event-resolver.js'

export async function identifyNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    organizationSlug?: string
    eventSlug: string
  }
  const { uid } = identifyNfcCardSchema.parse(request.body)

  const service = new IdentifyNfcCardService()
  try {
    const result = await service.execute({
      organizationSlug: params.organizationSlug ?? null,
      eventSlug: params.eventSlug,
      uid
    })

    return reply.status(200).send(result)
  } catch (error) {
    if (error instanceof AmbiguousEventSlugError) {
      return reply.status(409).send(buildAmbiguousEventSlugResponse(error))
    }

    throw error
  }
}
