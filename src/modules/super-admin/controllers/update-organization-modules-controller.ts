import { FastifyReply, FastifyRequest } from 'fastify'
import { updateOrganizationModulesParamsSchema, updateOrganizationModulesSchema } from '../schemas/update-organization-modules-schema.js'
import { UpdateOrganizationModulesService } from '../services/update-organization-modules-service.js'

export async function updateOrganizationModulesController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = updateOrganizationModulesParamsSchema.parse(request.params)
  const { modules } = updateOrganizationModulesSchema.parse(request.body)
  const service = new UpdateOrganizationModulesService()
  try {
    const result = await service.execute({ id, modules })
    return reply.send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Organization not found') {
      return reply.status(404).send({ message: 'Organization not found' })
    }
    throw error
  }
}
