import { UserRole } from '@prisma/client'
import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { RestoreEventService } from '../services/restore-event-service.js'

const restoreEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

const userRoleSchema = z.nativeEnum(UserRole)

export async function restoreEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    restoreEventParamsSchema.parse(request.params)

  const userRole =
    userRoleSchema.parse(request.user.role)

  const restoreEventService =
    new RestoreEventService()

  const result = await restoreEventService.execute({
    eventId,
    organizationId: request.user.organizationId,
    userRole
  })

  return reply.status(200).send(result)
}