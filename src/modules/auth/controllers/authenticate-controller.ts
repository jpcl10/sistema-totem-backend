import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { authenticateSchema } from '../schemas/authenticate-schema.js'
import { AuthenticateService } from '../services/authenticate-service.js'

export async function authenticateController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body = authenticateSchema.parse(request.body)

    const service = new AuthenticateService()

    const result = await service.execute(body)

    return reply.status(200).send(result)
  } catch (error) {
    // Handle Zod validation errors for invalid request body
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: 'Invalid request body.' })
    }
    
    // Handle invalid credentials with 401
    if (error instanceof Error && error.message === 'Invalid credentials.') {
      return reply.status(401).send({ message: 'Invalid credentials.' })
    }
    
    // For other errors, re-throw to let Fastify handle as 500
    throw error
  }
}
