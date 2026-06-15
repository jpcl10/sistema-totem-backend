import { FastifyReply, FastifyRequest } from 'fastify'

import { GetDeviceConfigService } from '../services/get-device-config-service.js'

export async function getDeviceConfigController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const service =
    new GetDeviceConfigService()

  const result =
    await service.execute({
      deviceId:
        request.device.deviceId
    })

  return reply.send(result)
}