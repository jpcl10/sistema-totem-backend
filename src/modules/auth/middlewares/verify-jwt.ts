import { FastifyReply, FastifyRequest } from 'fastify'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'

interface JwtPayload {
  sub: string
  role: string
  organizationId: string
}

export async function verifyJWT(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization

    if (!authHeader) {
      return reply.status(401).send({
        message: 'Unauthorized'
      })
    }

    const [, token] = authHeader.split(' ')

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload

    request.user = {
      sub: decoded.sub,
      role: decoded.role as UserRole,
      organizationId: decoded.organizationId
    }
  } catch {
    return reply.status(401).send({
      message: 'Invalid token'
    })
  }
}