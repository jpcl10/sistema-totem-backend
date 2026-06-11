import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { GetEventFinancialSummaryService } from '../services/get-event-financial-summary-service.js'

const getEventFinancialSummaryParamsSchema = z.object({
  eventId: z.string().min(1)
})

const getEventFinancialSummaryQuerySchema = z.object({
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

export async function getEventFinancialSummaryController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    getEventFinancialSummaryParamsSchema.parse(
      request.params
    )

  const {
    period,
    startDate,
    endDate
  } =
    getEventFinancialSummaryQuerySchema.parse(
      request.query
    )

  const organizationId =
    request.user.organizationId

  const getEventFinancialSummaryService =
    new GetEventFinancialSummaryService()

  const { summary } =
    await getEventFinancialSummaryService.execute({
      organizationId,
      eventId,
      period,
      startDate,
      endDate
    })

  return reply.status(200).send({
    summary
  })
}