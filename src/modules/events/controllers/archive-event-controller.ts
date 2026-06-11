import { UserRole } from '@prisma/client'
import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { ArchiveEventService } from '../services/archive-event-service.js'

const archiveEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

const userRoleSchema = z.nativeEnum(UserRole)

export async function archiveEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    archiveEventParamsSchema.parse(request.params)

  const userRole =
    userRoleSchema.parse(request.user.role)

  const archiveEventService =
    new ArchiveEventService()

  const result = await archiveEventService.execute({
    eventId,
    organizationId: request.user.organizationId,
    userRole
  })

  return reply.status(200).send(result)
}