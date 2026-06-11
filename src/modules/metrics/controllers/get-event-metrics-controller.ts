import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { GetEventMetricsService } from '../services/get-event-metrics-service.js'

export async function getEventMetricsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    eventId: string
  }

  const organizationId =
    request.user.organizationId

  const service =
    new GetEventMetricsService()

  const { metrics } =
    await service.execute({
      organizationId,
      eventId: params.eventId
    })

  return reply.send({
    metrics
  })
}