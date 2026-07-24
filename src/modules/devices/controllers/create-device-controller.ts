import { FastifyReply, FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { CreateDeviceService } from '../services/create-device-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

const optionalCuid = z.preprocess(
  value => value === null || value === '' ? undefined : value,
  z.string().cuid().optional()
)

const optionalString = z.preprocess(
  value => value === null || value === '' ? undefined : value,
  z.string().optional()
)

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
      'PRINT_AGENT',
      'CALL_SCREEN',
      'SK210'
    ]),

    eventId: optionalCuid,
    storeId: optionalCuid,
    locationName: optionalString,
    metadata: z.record(z.string(), z.unknown()).nullable().optional()
  })

  const {
    name,
    code,
    type,
    eventId,
    storeId,
    locationName,
    metadata
  } = bodySchema.parse(request.body)
  const organizationId = getTenantOrganizationId(request)

  const service = new CreateDeviceService()

  const result = await service.execute({
    organizationId,
    userRole: request.user.role,
    userId: request.user.sub,

    name,
    code,
    type,
    eventId,
    storeId,
    locationName,
    metadata: metadata as Prisma.InputJsonValue | null | undefined
  })

  return reply.status(201).send(result)
}
