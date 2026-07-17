import { FastifyReply, FastifyRequest } from 'fastify'
import { createNfcCardSchema } from '../schemas/create-nfc-card-schema.js'
import { CreateNfcCardService } from '../services/create-nfc-card-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function createNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string }

  const {
    uid,
    code,
    holderName,
    type,
    metadata
  } = createNfcCardSchema.parse(request.body)

  const service = new CreateNfcCardService()
  const organizationId = getTenantOrganizationId(request)

  try {
    const result = await service.execute({
      organizationId,
      userId: request.user.sub,
      eventId: paramsSchema.eventId,
      uid,
      code,
      holderName,
      type,
      metadata
    })

    return reply.status(201).send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'NFC card with this UID already exists') {
      return reply.status(409).send({ message: 'Cartão NFC já cadastrado' })
    }
    throw error
  }
}
