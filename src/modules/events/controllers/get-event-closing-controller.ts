import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { GetEventClosingService } from '../services/get-event-closing-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const getEventClosingParamsSchema = z.object({
  eventId: z.string().min(1)
})

export async function getEventClosingController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } =
    getEventClosingParamsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)

  const getEventClosingService =
    new GetEventClosingService()

  const result =
    await getEventClosingService.execute({
      eventId,
      organizationId,
      userRole: request.user.role
    })

  return reply.status(200).send(result)
}
