import { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../../../lib/prisma.js'

export async function profileController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = request.user.sub

  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true
    }
  })

  return reply.send({
    user
  })
}
