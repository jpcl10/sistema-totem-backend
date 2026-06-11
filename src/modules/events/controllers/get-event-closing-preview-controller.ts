import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { GetEventClosingPreviewService } from '../services/get-event-closing-preview-service.js'

const getEventClosingPreviewParamsSchema = z.object({
  eventId: z.string()
})

export async function getEventClosingPreviewController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    getEventClosingPreviewParamsSchema.parse(request.params)

  const organizationId = request.user.organizationId

  const getEventClosingPreviewService =
    new GetEventClosingPreviewService()

  const result =
    await getEventClosingPreviewService.execute({
      eventId,
      organizationId
    })

  return reply.status(200).send(result)
}