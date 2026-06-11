import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { ListPrintersService } from '../services/list-printers-service.js'

export async function listPrintersController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = request.params as {
    eventId: string
  }

  const organizationId =
    request.user.organizationId

  const service =
    new ListPrintersService()

  const { printers } =
    await service.execute({
      organizationId,
      eventId
    })

  return reply.send({
    printers
  })
}