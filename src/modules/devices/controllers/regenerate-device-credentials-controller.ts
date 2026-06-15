import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { RegenerateDeviceCredentialsService } from '../services/regenerate-device-credentials-service.js'

export async function regenerateDeviceCredentialsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = z.object({
    id: z.string().cuid()
  })

  const { id } =
    paramsSchema.parse(request.params)

  const service =
    new RegenerateDeviceCredentialsService()

  const result =
    await service.execute({
      organizationId:
        request.user.organizationId,

      deviceId: id
    })

  return reply.send(result)
}