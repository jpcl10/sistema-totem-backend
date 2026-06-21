import { FastifyReply, FastifyRequest } from 'fastify'

import { listNfcCardTransactionsSchema } from '../schemas/list-nfc-card-transactions-schema.js'
import { ListNfcCardTransactionsService } from '../services/list-nfc-card-transactions-service.js'

export async function listNfcCardTransactionsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string; id: string }

  const { page, limit } = listNfcCardTransactionsSchema.parse(request.query)

  const service = new ListNfcCardTransactionsService()

  try {
    const result = await service.execute({
      organizationId: request.user.organizationId,
      eventId: paramsSchema.eventId,
      nfcCardId: paramsSchema.id,
      page,
      limit
    })

    return reply.status(200).send(result)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Event not found' || error.message === 'NFC card not found') {
        return reply.status(404).send({ message: error.message })
      }
    }
    throw error
  }
}
