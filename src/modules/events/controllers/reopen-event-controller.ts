import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { ReopenEventService } from '../services/reopen-event-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const reopenEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

export async function reopenEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    reopenEventParamsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)

  const reopenEventService =
    new ReopenEventService()

  const result = await reopenEventService.execute({
    eventId,
    organizationId,
    userId: request.user.sub,
    userRole: request.user.role
  })

  return reply.status(200).send(result)
}
