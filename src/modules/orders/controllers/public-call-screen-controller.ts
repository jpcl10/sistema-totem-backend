import {
  FastifyReply,
  FastifyRequest
} from 'fastify'
import { z } from 'zod'

import { PublicCallScreenService } from '../services/public-call-screen-service.js'

const callScreenParamsSchema = z.object({
  slug: z.string().trim().min(1)
})

function handlePublicCallScreenError(error: unknown, reply: FastifyReply) {
  if (
    error instanceof Error &&
    error.message === 'Call screen context not found'
  ) {
    return reply.status(404).send({
      message: 'Call screen not found'
    })
  }

  throw error
}

export async function getPublicStoreCallScreenController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { slug } = callScreenParamsSchema.parse(request.params)
    const result = await new PublicCallScreenService().getBootstrap({
      contextType: 'STORE',
      slug
    })

    return reply.status(200).send(result)
  } catch (error) {
    return handlePublicCallScreenError(error, reply)
  }
}

export async function getPublicEventCallScreenController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { slug } = callScreenParamsSchema.parse(request.params)
    const result = await new PublicCallScreenService().getBootstrap({
      contextType: 'EVENT',
      slug
    })

    return reply.status(200).send(result)
  } catch (error) {
    return handlePublicCallScreenError(error, reply)
  }
}

export async function listPublicStoreCallScreenOrdersController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { slug } = callScreenParamsSchema.parse(request.params)
    const result = await new PublicCallScreenService().getOrders({
      contextType: 'STORE',
      slug
    })

    return reply.status(200).send(result)
  } catch (error) {
    return handlePublicCallScreenError(error, reply)
  }
}

export async function listPublicEventCallScreenOrdersController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { slug } = callScreenParamsSchema.parse(request.params)
    const result = await new PublicCallScreenService().getOrders({
      contextType: 'EVENT',
      slug
    })

    return reply.status(200).send(result)
  } catch (error) {
    return handlePublicCallScreenError(error, reply)
  }
}
