import { FastifyReply, FastifyRequest } from 'fastify'

import { updateSuperAdminUserSchema } from '../schemas/update-super-admin-user-schema.js'
import { UpdateSuperAdminUserService } from '../services/update-super-admin-user-service.js'

export async function updateSuperAdminUserController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = request.params as { id: string }
  const body = updateSuperAdminUserSchema.parse(request.body)
  const service = new UpdateSuperAdminUserService()

  try {
    const user = await service.execute({
      actorUserId: request.user.sub,
      userId: params.id,
      organizationId: body.organizationId,
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      confirmOrganizationChange: body.confirmOrganizationChange
    })

    return reply.send({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug
      },
      sessionVersion: user.sessionVersion,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return reply.status(404).send({ message: error.message })
    }

    if (error instanceof Error && error.message === 'Organization not found') {
      return reply.status(404).send({ message: error.message })
    }

    if (error instanceof Error && error.message === 'User already exists.') {
      return reply.status(409).send({ message: 'User already exists' })
    }

    if (
      error instanceof Error &&
      error.message === 'Organization change confirmation required'
    ) {
      return reply.status(400).send({
        code: 'ORGANIZATION_CHANGE_CONFIRMATION_REQUIRED',
        message: error.message
      })
    }

    throw error
  }
}
