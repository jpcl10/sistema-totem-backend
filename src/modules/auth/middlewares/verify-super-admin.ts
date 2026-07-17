import { FastifyReply, FastifyRequest } from 'fastify'
import { UserRole } from '@prisma/client'

export async function verifySuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (request.user.role !== UserRole.SUPER_ADMIN) {
    return reply.status(403).send({
      message: 'Forbidden: Only SUPER_ADMIN can access this endpoint'
    })
  }
}
