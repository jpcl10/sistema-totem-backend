import { FastifyReply, FastifyRequest } from 'fastify'

import { debitNfcCardSchema } from '../schemas/debit-nfc-card-schema.js'
import { DebitNfcCardService } from '../services/debit-nfc-card-service.js'

export async function debitNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string; id: string }

  const { amountInCents, description } = debitNfcCardSchema.parse(request.body)

  const service = new DebitNfcCardService()

  try {
    const result = await service.execute({
      organizationId: request.user.organizationId,
      userId: request.user.sub,
      eventId: paramsSchema.eventId,
      nfcCardId: paramsSchema.id,
      amountInCents,
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
      if (error.message === 'Insufficient balance') {
        return reply.status(400).send({ message: 'Saldo insuficiente' })
      }
    }
    throw error
  }
}
