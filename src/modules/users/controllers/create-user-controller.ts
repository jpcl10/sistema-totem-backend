import { FastifyReply, FastifyRequest } from 'fastify'

import { createUserSchema } from '../schemas/create-user-schema.js'
import { CreateUserService } from '../services/create-user-service.js'

export async function createUserController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = createUserSchema.parse(request.body)

  const service = new CreateUserService()

  const user = await service.execute(body)

  return reply.status(201).send(user)
}