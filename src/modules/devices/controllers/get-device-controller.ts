import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { GetDeviceService } from '../services/get-device-service.js'

export async function getDeviceController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = z.object({
    id: z.string().cuid()
  })

  const { id } =
    paramsSchema.parse(request.params)

  const service = new GetDeviceService()

  const result = await service.execute({
    organizationId:
      request.user.organizationId,

    deviceId: id
  })

  return reply.send(result)
}