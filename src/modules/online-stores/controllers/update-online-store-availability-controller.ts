import { UserRole } from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { OnlineStoreSettingsService } from '../../settings/services/online-store-settings-service.js'
import {
  onlineStoreAvailabilityParamsSchema,
  updateOnlineStoreAvailabilitySchema
} from '../schemas/online-store-availability-schema.js'

export async function updateOnlineStoreAvailabilityController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { storeId } = onlineStoreAvailabilityParamsSchema.parse(request.params)
  const body = updateOnlineStoreAvailabilitySchema.parse(request.body)
  const organizationId = getTenantOrganizationId(request)

  if (
    request.user.role !== UserRole.ADMIN &&
    request.user.role !== UserRole.SUPER_ADMIN
  ) {
    return reply.status(403).send({ message: 'Sem permissão para alterar o status da loja' })
  }

  try {
    const result = await new OnlineStoreSettingsService().updateAvailability({
      organizationId,
      userId: request.user.sub,
      storeId,
      mode: body.mode,
      until: body.until ? new Date(body.until) : null,
      reason: body.reason ?? null
    })

    return reply.send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Store not found') {
      return reply.status(404).send({ message: 'Loja não encontrada' })
    }

    throw error
  }
}
