import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { updateEventProductSchema } from '../schemas/update-event-product-schema.js'

import { UpdateEventProductService } from '../services/update-event-product-service.js'

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

  const organizationId =
    request.user.organizationId

  const service =
    new UpdateEventProductService()

  const { eventProduct } =
    await service.execute({
      organizationId,

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
}