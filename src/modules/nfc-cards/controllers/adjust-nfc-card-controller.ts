import { FastifyReply, FastifyRequest } from 'fastify'

import { adjustNfcCardSchema } from '../schemas/adjust-nfc-card-schema.js'
import { AdjustNfcCardService } from '../services/adjust-nfc-card-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function adjustNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string; id: string }

  const { newBalanceInCents, description } = adjustNfcCardSchema.parse(request.body)

  const service = new AdjustNfcCardService()
  const organizationId = getTenantOrganizationId(request)

  try {
    const result = await service.execute({
      organizationId,
      userId: request.user.sub,
      eventId: paramsSchema.eventId,
      nfcCardId: paramsSchema.id,
      newBalanceInCents,
      description
    })

    return reply.status(200).send(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Event not found' || error.message === 'NFC card not found') {
        return reply.status(404).send({ message: error.message })
      }
      if (error.message === 'NFC card is not active') {
        return reply.status(400).send({ message: 'Cartão NFC não está ativo' })
      }
    }
    throw error
  }
}
