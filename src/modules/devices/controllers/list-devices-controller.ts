import { FastifyReply, FastifyRequest } from 'fastify'

import { ListDevicesService } from '../services/list-devices-service.js'

export async function listDevicesController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const service = new ListDevicesService()

  const result = await service.execute({
    organizationId:
      request.user.organizationId
  })

  return reply.send(result)
}