import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'

import { logger } from './logger.js'
import { prisma } from './prisma.js'
import {
  corsAllowedHeaders,
  corsAllowedMethods,
  validateSocketCorsOrigin
} from './cors.js'
import { redisConfig } from '../shared/config/redis.js'
import { createRedisConnection } from '../infra/redis/redis-client.js'

export let io: Server

export function setSocketServerForTests(socketServer: Server) {
  io = socketServer
}

interface SocketJwtPayload {
  sub: string
  role: UserRole
  organizationId?: string | null
}

function readSingleValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].trim()
      ? value[0]
      : undefined
  }

  return typeof value === 'string' && value.trim()
    ? value
    : undefined
}

function readSocketToken(socket: any): string | undefined {
  const authToken = readSingleValue(socket.handshake.auth?.token)
  const authorization = readSingleValue(socket.handshake.headers?.authorization)

  if (authToken) {
    return authToken.startsWith('Bearer ')
      ? authToken.slice('Bearer '.length)
      : authToken
  }

  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length)
  }

  return undefined
}

function readSocketOrganizationId(socket: any): string | undefined {
  return (
    readSingleValue(socket.handshake.auth?.organizationId) ??
    readSingleValue(socket.handshake.headers?.['x-organization-id'])
  )
}

async function resolveSocketTenantContext(socket: any) {
  const token = readSocketToken(socket)

  if (!token) {
    return null
  }

  const decoded = jwt.verify(
    token,
    process.env.JWT_SECRET as string
  ) as SocketJwtPayload

  if (decoded.role === UserRole.SUPER_ADMIN) {
    const organizationId = readSocketOrganizationId(socket)

    if (!organizationId) {
      return null
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId
      },
      select: {
        id: true
      }
    })

    if (!organization) {
      return null
    }

    return {
      organizationId: organization.id,
      actingUserId: decoded.sub,
      actingUserRole: UserRole.SUPER_ADMIN,
      impersonated: true
    }
  }

  if (!decoded.organizationId) {
    return null
  }

  const requestedOrganizationId = readSocketOrganizationId(socket)

  if (
    requestedOrganizationId &&
    requestedOrganizationId !== decoded.organizationId
  ) {
    return null
  }

  return {
    organizationId: decoded.organizationId,
    actingUserId: decoded.sub,
    actingUserRole: decoded.role,
    impersonated: false
  }
}

export async function setupSocket(server: any) {
  io = new Server(server, {
    cors: {
      origin: validateSocketCorsOrigin,
      methods: corsAllowedMethods,
      allowedHeaders: corsAllowedHeaders,
      credentials: true
    }
  })

  if (redisConfig.enabled) {
    const publisher = createRedisConnection('socket-publisher')
    const subscriber = createRedisConnection('socket-subscriber')

    if (publisher && subscriber) {
      try {
        await Promise.all([
          publisher.connect(),
          subscriber.connect()
        ])

        io.adapter(createAdapter(publisher, subscriber, {
          key: `${redisConfig.keyPrefix}:socket.io`
        }))

        logger.info(
          {
            redisKeyPrefix: redisConfig.keyPrefix
          },
          'Socket.IO Redis adapter enabled'
        )
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : 'Redis adapter error'
          },
          'Socket.IO Redis adapter unavailable; using memory adapter'
        )
      }
    }
  } else {
    logger.info('Socket.IO memory adapter enabled')
  }

  io.on('connection', async (socket) => {
    logger.info({ socketId: socket.id }, 'Socket connected')

    try {
      const tenantContext = await resolveSocketTenantContext(socket)

      if (tenantContext) {
        socket.data.tenantContext = tenantContext
        socket.join(`organization:${tenantContext.organizationId}`)

        logger.info(
          {
            socketId: socket.id,
            organizationId: tenantContext.organizationId,
            impersonated: tenantContext.impersonated
          },
          'Socket joined organization room'
        )
      } else {
        logger.warn(
          { socketId: socket.id },
          'Socket connected without tenant context; operational rooms disabled'
        )
      }
    } catch (error) {
      logger.warn(
        { socketId: socket.id, error },
        'Socket tenant context resolution failed; operational rooms disabled'
      )
    }

    socket.on('join-event-room', async (eventId: string) => {
      const tenantContext = socket.data.tenantContext

      if (!tenantContext?.organizationId) {
        logger.warn(
          { socketId: socket.id, eventId },
          'Socket event room join denied without tenant context'
        )

        return
      }

      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
          organizationId: tenantContext.organizationId
        },
        select: {
          id: true
        }
      })

      if (!event) {
        logger.warn(
          {
            socketId: socket.id,
            eventId,
            organizationId: tenantContext.organizationId
          },
          'Socket event room join denied by tenant boundary'
        )

        return
      }

      socket.join(`event:${eventId}`)
      logger.info(
        {
          socketId: socket.id,
          eventId,
          organizationId: tenantContext.organizationId
        },
        'Socket joined event room'
      )
    })

    socket.on('join-call-screen-store', async (slug: string) => {
      const store = await prisma.onlineStore.findFirst({
        where: {
          slug,
          active: true
        },
        select: {
          id: true,
          slug: true
        }
      })

      if (!store) {
        logger.warn(
          { socketId: socket.id, slug },
          'Public call screen store room join denied because store was not found'
        )

        return
      }

      socket.join(`call-screen:store:${store.id}`)
      logger.info(
        {
          socketId: socket.id,
          storeId: store.id
        },
        'Socket joined public store call screen room'
      )
    })

    socket.on('join-call-screen-event', async (slug: string) => {
      const event = await prisma.event.findFirst({
        where: {
          slug,
          active: true
        },
        select: {
          id: true,
          slug: true
        }
      })

      if (!event) {
        logger.warn(
          { socketId: socket.id, slug },
          'Public call screen event room join denied because event was not found'
        )

        return
      }

      socket.join(`call-screen:event:${event.id}`)
      logger.info(
        {
          socketId: socket.id,
          eventId: event.id
        },
        'Socket joined public event call screen room'
      )
    })

    socket.on('leave-organization-room', () => {
      const tenantContext = socket.data.tenantContext

      if (!tenantContext?.organizationId) {
        return
      }

      socket.leave(`organization:${tenantContext.organizationId}`)
      socket.data.tenantContext = null

      for (const room of socket.rooms) {
        if (room.startsWith('event:')) {
          socket.leave(room)
        }
      }

      logger.info(
        {
          socketId: socket.id,
          organizationId: tenantContext.organizationId
        },
        'Socket left organization and operational rooms'
      )
    })

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Socket disconnected')
    })
  })
}
