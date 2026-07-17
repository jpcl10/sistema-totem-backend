import { FastifyReply, FastifyRequest } from 'fastify'
import { ListSuperAdminUsersService } from '../services/list-super-admin-users-service.js'

export async function listSuperAdminUsersController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const service = new ListSuperAdminUsersService()
  const users = await service.execute()
  return reply.send(users)
}
