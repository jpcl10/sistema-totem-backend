import {
  FastifyReply,
  FastifyRequest
} from 'fastify'

import { createEventProductSchema } from '../schemas/create-event-product-schema.js'

import { CreateEventProductService } from '../services/create-event-product-service.js'

export async function createEventProductController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as {
    eventId: string
  }

  const body =
    createEventProductSchema.parse(
      request.body
    )

  const organizationId =
    request.user.organizationId

  const service =
    new CreateEventProductService()

  const { eventProduct } =
    await service.execute({
      organizationId,

      eventId: params.eventId,

      catalogProductId:
        body.catalogProductId,

      priceInCents:
        body.priceInCents
    })

  return reply.status(201).send({
    eventProduct
  })
}