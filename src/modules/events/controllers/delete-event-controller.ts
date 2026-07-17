import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { DeleteEventService } from '../services/delete-event-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const deleteEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

export async function deleteEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    deleteEventParamsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)

  const deleteEventService =
    new DeleteEventService()

  const result = await deleteEventService.execute({
    eventId,
    organizationId,
    userRole: request.user.role
  })

  return reply.status(200).send(result)
}
