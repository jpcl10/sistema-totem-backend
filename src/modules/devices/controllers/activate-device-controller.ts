import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { ActivateDeviceService } from '../services/activate-device-service.js'

export async function activateDeviceController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const bodySchema = z.object({
    code: z.string().min(1).optional(),
    secret: z.string().min(1).optional(),
    deviceCode: z.string().min(1).optional(),
    deviceSecret: z.string().min(1).optional(),
    appVersion: z.string().optional()
  }).refine((value) => value.code || value.deviceCode, {
    message: 'Device code is required'
  }).refine((value) => value.secret || value.deviceSecret, {
    message: 'Device secret is required'
  })

  const {
    code,
    secret,
    deviceCode,
    deviceSecret,
    appVersion
  } = bodySchema.parse(request.body)

  const service =
    new ActivateDeviceService()

  const result =
    await service.execute({
      code: code ?? deviceCode!,
      secret: secret ?? deviceSecret!,
      appVersion,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null
    })

  return reply.send(result)
}
