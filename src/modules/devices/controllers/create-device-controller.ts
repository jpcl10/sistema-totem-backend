import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { CreateDeviceService } from '../services/create-device-service.js'

export async function createDeviceController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const bodySchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),

    type: z.enum([
      'TOTEM',
      'PRINTER',
      'CALL_SCREEN',
      'SK210'
    ]),

    eventId: z.string().cuid().optional(),
    locationName: z.string().optional()
  })

  const {
    name,
    code,
    type,
    eventId,
    locationName
  } = bodySchema.parse(request.body)

  const service = new CreateDeviceService()

  const result = await service.execute({
    organizationId:
      request.user.organizationId,

    name,
    code,
    type,
    eventId,
    locationName
  })

  return reply.status(201).send(result)
}