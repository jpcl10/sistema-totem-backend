import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { UpdateDeviceService } from '../services/update-device-service.js'

export async function updateDeviceController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = z.object({
    id: z.string().cuid()
  })

  const bodySchema = z.object({
    name: z.string().optional(),

    eventId: z
      .string()
      .cuid()
      .nullable()
      .optional(),

    locationName: z.string().nullable().optional(),

    status: z
      .enum([
        'ACTIVE',
        'PAUSED',
        'OFFLINE',
        'MAINTENANCE'
      ])
      .optional(),

    type: z
      .enum([
        'TOTEM',
        'PRINTER',
        'CALL_SCREEN',
        'SK210'
      ])
      .optional()
  })

  const { id } =
    paramsSchema.parse(request.params)

  const body =
    bodySchema.parse(request.body)

  const service =
    new UpdateDeviceService()

  const result =
    await service.execute({
      organizationId:
        request.user.organizationId,

      deviceId: id,

      ...body
    })

  return reply.send(result)
}