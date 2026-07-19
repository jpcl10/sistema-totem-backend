import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { HealthService } from '../services/health-service.js'

export async function healthController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const service = new HealthService()
  const healthData = await service.execute()

  const statusCode =
    healthData.status === 'ok' || healthData.status === 'degraded'
      ? 200
      : 503
  return reply.status(statusCode).send(healthData)
}
