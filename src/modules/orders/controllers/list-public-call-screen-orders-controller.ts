import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { ListPublicCallScreenOrdersService } from '../services/list-public-call-screen-orders-service.js'

const listPublicCallScreenOrdersParamsSchema = z.object({
  slug: z.string()
})

export async function listPublicCallScreenOrdersController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { slug } =
    listPublicCallScreenOrdersParamsSchema.parse(request.params)

  const listPublicCallScreenOrdersService =
    new ListPublicCallScreenOrdersService()

  const result =
    await listPublicCallScreenOrdersService.execute({
      eventSlug: slug
    })

  return reply.status(200).send(result)
}