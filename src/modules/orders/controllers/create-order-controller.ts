import { FastifyReply, FastifyRequest } from 'fastify'

import { createOrderSchema } from '../schemas/create-order-schema.js'
import { CreateOrderService } from '../services/create-order-service.js'

export async function createOrderController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { slug } = request.params as {
    slug: string
  }

  const {
    customerName,
    paymentStatus,
    items
  } = createOrderSchema.parse(request.body)

  const createOrderService = new CreateOrderService()

  const { order } = await createOrderService.execute({
    eventSlug: slug,
    customerName,
    paymentStatus,
    items
  })

  return reply.status(201).send({
    order
  })
}