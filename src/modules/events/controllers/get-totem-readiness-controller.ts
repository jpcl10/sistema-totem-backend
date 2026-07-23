import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { GetTotemReadinessService } from '../services/get-totem-readiness-service.js'

export async function getTotemReadinessController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = request.params as {
    eventId: string
  }
  const organizationId = getTenantOrganizationId(request)

  const result = await new GetTotemReadinessService().execute({
    organizationId,
    eventId
  })

  return reply.send(result)
}
