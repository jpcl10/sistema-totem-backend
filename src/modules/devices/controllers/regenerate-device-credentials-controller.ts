import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { RegenerateDeviceCredentialsService } from '../services/regenerate-device-credentials-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function regenerateDeviceCredentialsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = z.object({
    id: z.string().cuid()
  })

  const { id } =
    paramsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)

  const service =
    new RegenerateDeviceCredentialsService()

  const result =
    await service.execute({
      organizationId,
      userRole: request.user.role,
      deviceId: id
    })

  return reply.send(result)
}
