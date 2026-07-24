import { FastifyReply, FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { UpdateDeviceService } from '../services/update-device-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const optionalCuid = z.preprocess(
  value => value === null || value === '' ? undefined : value,
  z.string().cuid().optional()
)

const optionalString = z.preprocess(
  value => value === null || value === '' ? undefined : value,
  z.string().optional()
)

export async function updateDeviceController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const paramsSchema = z.object({
    id: z.string().cuid()
  })

  const bodySchema = z.object({
    name: z.string().optional(),

    eventId: optionalCuid,

    storeId: optionalCuid,

    locationName: optionalString,
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),

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
        'PRINT_AGENT',
        'CALL_SCREEN',
        'SK210'
      ])
      .optional()
  })

  const { id } =
    paramsSchema.parse(request.params)

  const body =
    bodySchema.parse(request.body)
  const organizationId = getTenantOrganizationId(request)

  const service =
    new UpdateDeviceService()

  const result =
    await service.execute({
      organizationId,
      userRole: request.user.role,
      deviceId: id,
      ...body,
      metadata: body.metadata as Prisma.InputJsonValue | null | undefined
    })

  return reply.send(result)
}
