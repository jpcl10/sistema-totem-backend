import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { ActivateDeviceService } from '../services/activate-device-service.js'

export async function activateDeviceController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const bodySchema = z.object({
    code: z.string().min(1),
    secret: z.string().min(1),
    appVersion: z.string().optional()
  })

  const {
    code,
    secret,
    appVersion
  } = bodySchema.parse(request.body)

  const service =
    new ActivateDeviceService()

  const result =
    await service.execute({
      code,
      secret,
      appVersion,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null
    })

  return reply.send(result)
}