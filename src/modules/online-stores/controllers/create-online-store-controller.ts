import { FastifyReply, FastifyRequest } from 'fastify'
import { createOnlineStoreSchema } from '../schemas/create-online-store-schema.js'
import { CreateOnlineStoreService } from '../services/create-online-store-service.js'
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'

export async function createOnlineStoreController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = createOnlineStoreSchema.parse(request.body)
  const organizationId = getTenantOrganizationId(request)
  const service = new CreateOnlineStoreService()

  try {
    const result = await service.execute({
      organizationId,
      userRole: request.user.role,
      ...body
    })
    return reply.status(201).send(result)
  } catch (error) {
    if (error instanceof Error && error.message === 'Slug is already in use') {
      return reply.status(409).send({ message: 'Slug já está em uso' })
    }
    if (error instanceof Error && error.message === 'Online orders module is not enabled for this organization') {
      return reply.status(403).send({ message: 'Módulo de pedidos online não está habilitado para esta organização' })
    }
    throw error
  }
}
