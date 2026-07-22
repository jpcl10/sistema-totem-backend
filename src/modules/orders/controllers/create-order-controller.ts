import { FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

import { createOrderSchema } from '../schemas/create-order-schema.js'
import { CreateOrderService } from '../services/create-order-service.js'
import {
  AmbiguousEventSlugError,
  buildAmbiguousEventSlugResponse
} from '../../events/services/public-event-resolver.js'

export async function createOrderController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const params = request.params as {
      slug?: string
      organizationSlug?: string
      eventSlug?: string
    }

    const {
      customerName,
      customerId,
      paymentStatus,
      items
    } = createOrderSchema.parse(request.body)

    const createOrderService = new CreateOrderService()

    const { order } = await createOrderService.execute({
      organizationSlug: params.organizationSlug ?? null,
      eventSlug: params.eventSlug ?? params.slug ?? '',
      deviceId: request.device?.deviceId ?? null,
      customerName,
      customerId,
      paymentStatus,
      items
    })

    return reply.status(201).send({
      order
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: 'Invalid order payload',
        issues: error.issues
      })
    }

    if (error instanceof Error) {
      if (error instanceof AmbiguousEventSlugError) {
        return reply.status(409).send(buildAmbiguousEventSlugResponse(error))
      }

      if (error.message === 'Event not found') {
        return reply.status(404).send({
          message: error.message
        })
      }

      return reply.status(400).send({
        message: error.message
      })
    }

    throw error
  }
}
