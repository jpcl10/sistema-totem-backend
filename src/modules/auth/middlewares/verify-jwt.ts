import { FastifyReply, FastifyRequest } from 'fastify'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'

interface JwtPayload {
  sub: string
  role: string
  organizationId: string
  sessionVersion?: number
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        role: true,
        organizationId: true,
        sessionVersion: true
      }
    })

    if (!user || decoded.sessionVersion !== user.sessionVersion) {
      return reply.status(401).send({
        message: 'Invalid token'
      })
    }

    request.user = {
      sub: user.id,
      role: user.role as UserRole,
      organizationId: user.organizationId,
      sessionVersion: user.sessionVersion
    }
  } catch {
    return reply.status(401).send({
      message: 'Invalid token'
    })
  }
}
