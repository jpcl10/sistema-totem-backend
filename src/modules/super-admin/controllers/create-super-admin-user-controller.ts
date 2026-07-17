import { FastifyReply, FastifyRequest } from 'fastify'
import { createSuperAdminUserSchema } from '../schemas/create-super-admin-user-schema.js'
import { CreateUserService } from '../../users/services/create-user-service.js'

export async function createSuperAdminUserController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = createSuperAdminUserSchema.parse(request.body)
  const service = new CreateUserService()
  try {
    const user = await service.execute(body)
    return reply.status(201).send({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists.') {
      return reply.status(409).send({ message: 'User already exists' })
    }
    throw error
  }
}
