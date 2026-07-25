import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { ListEventManualSaleCatalogService } from '../services/list-event-manual-sale-catalog-service.js'

const paramsSchema = z.object({
  eventId: z.string().min(1)
})

export async function listEventManualSaleCatalogController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = paramsSchema.parse(request.params)
  const organizationId = getTenantOrganizationId(request)

  try {
    const result = await new ListEventManualSaleCatalogService().execute({
      organizationId,
      eventId
    })

    return reply.send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Event not found') {
      return reply.status(404).send({
        code: 'EVENT_NOT_FOUND',
        message: 'Evento n\u00e3o encontrado.'
      })
    }

    throw error
  }
}
