import { UserRole } from '@prisma/client'
import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { DeleteEventService } from '../services/delete-event-service.js'

const deleteEventParamsSchema = z.object({
  eventId: z.string().min(1)
})

const userRoleSchema = z.nativeEnum(UserRole)

export async function deleteEventController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    deleteEventParamsSchema.parse(request.params)

  const userRole =
    userRoleSchema.parse(request.user.role)

  const deleteEventService =
    new DeleteEventService()

  const result = await deleteEventService.execute({
    eventId,
    organizationId: request.user.organizationId,
    userRole
  })

  return reply.status(200).send(result)
}