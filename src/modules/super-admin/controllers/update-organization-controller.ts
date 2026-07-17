import { FastifyReply, FastifyRequest } from 'fastify'
import { updateOrganizationParamsSchema, updateOrganizationSchema } from '../schemas/update-organization-schema.js'
import { UpdateOrganizationService } from '../services/update-organization-service.js'

export async function updateOrganizationController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = updateOrganizationParamsSchema.parse(request.params)
  const body = updateOrganizationSchema.parse(request.body)
  const service = new UpdateOrganizationService()
  try {
    const result = await service.execute({ id, ...body })
    return reply.send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Slug already in use') {
      return reply.status(409).send({ message: 'Slug already in use' })
    }
    if (error instanceof Error && error.message === 'Organization not found') {
      return reply.status(404).send({ message: 'Organization not found' })
    }
    throw error
  }
}
