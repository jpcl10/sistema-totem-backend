import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { DeviceHeartbeatService } from '../services/device-heartbeat-service.js'

export async function deviceHeartbeatController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const bodySchema = z.object({
    appVersion: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })

  const {
    appVersion,
    metadata
  } = bodySchema.parse(request.body)

  const service =
    new DeviceHeartbeatService()

  const result =
    await service.execute({
      deviceId:
        request.device.deviceId,

      appVersion,

      metadata,

      ipAddress: request.ip,

      userAgent:
        request.headers['user-agent'] ?? null
    })

  return reply.send(result)
}