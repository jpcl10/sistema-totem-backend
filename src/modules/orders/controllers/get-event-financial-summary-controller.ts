import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { GetEventFinancialSummaryService } from '../services/get-event-financial-summary-service.js'

const getEventFinancialSummaryParamsSchema = z.object({
  eventId: z.string()
})

export async function getEventFinancialSummaryController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    getEventFinancialSummaryParamsSchema.parse(request.params)

  const organizationId =
    request.user.organizationId

  const getEventFinancialSummaryService =
    new GetEventFinancialSummaryService()

  const { summary } =
    await getEventFinancialSummaryService.execute({
      organizationId,
      eventId
    })

  return reply.status(200).send({
    summary
  })
}