import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { RestoreEventService } from '../services/restore-event-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const restoreEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

export async function restoreEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    restoreEventParamsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)

  const restoreEventService =
    new RestoreEventService()

  const result = await restoreEventService.execute({
    eventId,
    organizationId,
    userRole: request.user.role
  })

  return reply.status(200).send(result)
}
