import { FastifyReply, FastifyRequest } from 'fastify'

import { readNfcCardSchema } from '../schemas/read-nfc-card-schema.js'
import { ReadNfcCardService } from '../services/read-nfc-card-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function readNfcCardController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = request.params as { eventId: string }

  const { uid } = readNfcCardSchema.parse(request.body)

  const service = new ReadNfcCardService()
  const organizationId = getTenantOrganizationId(request)

  const result = await service.execute({
    organizationId,
    userId: request.user.sub,
    eventId: paramsSchema.eventId,
    uid
  })

  return reply.status(200).send(result)
}
