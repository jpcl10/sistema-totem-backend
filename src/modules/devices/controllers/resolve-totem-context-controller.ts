import { FastifyReply, FastifyRequest } from 'fastify'

import { ResolveTotemContextService } from '../services/resolve-totem-context-service.js'

export async function resolveTotemContextController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const service =
    new ResolveTotemContextService()

  try {
    const context =
      await service.execute({
        deviceId: request.device.deviceId
      })

    return reply.send({
      context
    })
  } catch (error) {
    if (error instanceof Error) {
      const status =
        error.message === 'Device not found'
          ? 404
          : error.message === 'Totem V2 is not enabled for this device'
            ? 403
            : 400

      return reply.status(status).send({
        message: error.message
      })
    }

    throw error
  }
}
