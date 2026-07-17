import { FastifyReply, FastifyRequest } from 'fastify'

import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'
import { listAvailableEventProductsQuerySchema } from '../schemas/list-available-event-products-schema.js'
import { ListAvailableEventProductsService } from '../services/list-available-event-products-service.js'

export async function listAvailableEventProductsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    eventId: string
  }

  const query = listAvailableEventProductsQuerySchema.parse(request.query)
  const organizationId = getTenantOrganizationId(request)

  const service = new ListAvailableEventProductsService()

  try {
    const result = await service.execute({
      organizationId,
      eventId: params.eventId,
      search: query.search,
      categoryId: query.categoryId,
      active: query.active,
      page: query.page,
      limit: query.limit
    })

    return reply.status(200).send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Event not found') {
      return reply.status(404).send({ message: 'Event not found' })
    }

    throw error
  }
}
