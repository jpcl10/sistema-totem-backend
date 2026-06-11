import { UserRole } from '@prisma/client'
import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { ReopenEventService } from '../services/reopen-event-service.js'

const reopenEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

const userRoleSchema = z.nativeEnum(UserRole)

export async function reopenEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    reopenEventParamsSchema.parse(request.params)

  const userRole =
    userRoleSchema.parse(request.user.role)

  const reopenEventService =
    new ReopenEventService()

  const result = await reopenEventService.execute({
    eventId,
    organizationId: request.user.organizationId,
    userId: request.user.sub,
    userRole
  })

  return reply.status(200).send(result)
}