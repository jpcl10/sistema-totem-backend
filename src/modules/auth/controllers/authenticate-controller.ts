import { FastifyReply, FastifyRequest } from 'fastify'

import { authenticateSchema } from '../schemas/authenticate-schema.js'
import { AuthenticateService } from '../services/authenticate-service.js'

export async function authenticateController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = authenticateSchema.parse(request.body)

  const service = new AuthenticateService()

  const result = await service.execute(body)

  return reply.status(200).send(result)
}
