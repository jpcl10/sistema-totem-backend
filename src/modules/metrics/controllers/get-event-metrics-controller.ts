import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { GetEventMetricsService } from '../services/get-event-metrics-service.js'

const getEventMetricsParamsSchema = z.object({
  eventId: z.string().min(1)
})

const getEventMetricsQuerySchema = z.object({
  period: z
    .enum([
      'EVENT',
      'TODAY',
      '24H',
      '7D',
      'CUSTOM'
    ])
    .default('EVENT'),

  startDate: z
    .string()
    .optional(),

  endDate: z
    .string()
    .optional()
})

export async function getEventMetricsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    getEventMetricsParamsSchema.parse(
      request.params
    )

  const {
    period,
    startDate,
    endDate
  } = getEventMetricsQuerySchema.parse(
    request.query
  )

  const organizationId =
    request.user.organizationId

  const service =
    new GetEventMetricsService()

  const { metrics } =
    await service.execute({
      organizationId,
      eventId,
      period,
      startDate,
      endDate
    })

  return reply.status(200).send({
    metrics
  })
}