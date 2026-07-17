import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { ArchiveEventService } from '../services/archive-event-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const archiveEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

export async function archiveEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    archiveEventParamsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)

  const archiveEventService =
    new ArchiveEventService()

  const result = await archiveEventService.execute({
    eventId,
    organizationId,
    userRole: request.user.role
  })

  return reply.status(200).send(result)
}
