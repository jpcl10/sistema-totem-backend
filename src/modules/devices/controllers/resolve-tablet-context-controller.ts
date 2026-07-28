import { FastifyReply, FastifyRequest } from 'fastify'

import { ResolveTabletContextService } from '../services/resolve-tablet-context-service.js'

export async function resolveTabletContextController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const service = new ResolveTabletContextService()

  try {
    const context = await service.execute({
      deviceId: request.device.deviceId
    })

    return reply.send({ context })
  } catch (error) {
    if (error instanceof Error) {
      const status =
        error.message === 'Device not found'
          ? 404
          : error.message.includes('not enabled') ||
              error.message.includes('requires') ||
              error.message.includes('not a tablet')
            ? 403
            : 400

      return reply.status(status).send({
        message: error.message
      })
    }

    throw error
  }
}
