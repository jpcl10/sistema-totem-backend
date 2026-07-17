import { FastifyReply, FastifyRequest } from 'fastify'

import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { syncEventCatalogQuerySchema } from '../schemas/sync-event-catalog-schema.js'
import { SyncEventCatalogService } from '../services/sync-event-catalog-service.js'

export async function syncEventCatalogController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    eventId: string
  }
  const query = syncEventCatalogQuerySchema.parse(request.query)
  const organizationId = getTenantOrganizationId(request)

  const service = new SyncEventCatalogService()

  try {
    const result = await service.execute({
      organizationId,
      userId: request.user.sub,
      userRole: request.user.role,
      eventId: params.eventId,
      dryRun: query.dryRun
    })

    return reply.status(200).send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return reply.status(403).send({ message: error.message })
    }

    if (error instanceof Error && error.message === 'Event not found') {
      return reply.status(404).send({ message: error.message })
    }

    throw error
  }
}
