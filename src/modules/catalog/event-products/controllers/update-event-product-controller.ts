import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { updateEventProductSchema } from '../schemas/update-event-product-schema.js'
import { UpdateEventProductService } from '../services/update-event-product-service.js'
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js'

export async function updateEventProductController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    eventId: string
    eventProductId: string
  }

  const body =
    updateEventProductSchema.parse(
      request.body
    )

  const userId = request.user.sub
  const organizationId = getTenantOrganizationId(request)

  const service =
    new UpdateEventProductService()

  try {
    const { eventProduct } =
      await service.execute({
        organizationId,
        userId,

        eventId: params.eventId,

        eventProductId:
          params.eventProductId,

        priceInCents:
          body.priceInCents,

        trackStock:
          body.trackStock,

        stockQuantity:
          body.stockQuantity,

        soldOut:
          body.soldOut,

        active:
          body.active
      })

    return reply.send({
      eventProduct
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message === 'Event not found' ||
        error.message === 'Event product not found'
      )
    ) {
      return reply.status(404).send({ message: error.message })
    }

    if (
      error instanceof Error &&
      error.message === 'Stock quantity is required when stock tracking is enabled'
    ) {
      return reply.status(400).send({ message: error.message })
    }

    throw error
  }
}
