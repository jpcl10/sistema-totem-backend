import { FastifyReply, FastifyRequest } from 'fastify'
import { createOrganizationSchema } from '../schemas/create-organization-schema.js'
import { CreateOrganizationService } from '../services/create-organization-service.js'

export async function createOrganizationController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = createOrganizationSchema.parse(request.body)
  const service = new CreateOrganizationService()
  try {
    const result = await service.execute(body)
    return reply.status(201).send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Slug already in use') {
      return reply.status(409).send({ message: 'Slug already in use' })
    }
    throw error
  }
}
