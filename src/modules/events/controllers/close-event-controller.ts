import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { closeEventBodySchema } from '../schemas/close-event-schema.js'
import { CloseEventService } from '../services/close-event-service.js'

const closeEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

export async function closeEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    closeEventParamsSchema.parse(request.params)

  const {
    notes,
    allowPendingOrders,
    allowPrintErrors
  } = closeEventBodySchema.parse(request.body ?? {})

  const organizationId =
    request.user.organizationId

  const closedByUserId =
    request.user.sub

  const closeEventService =
    new CloseEventService()

  const result =
    await closeEventService.execute({
      eventId,
      organizationId,
      closedByUserId,
      notes,
      allowPendingOrders,
      allowPrintErrors
    })

  return reply.status(201).send(result)
}