import { Redis, RedisOptions } from 'ioredis'

import { logger } from '../../lib/logger.js'
import { redisConfig } from '../../shared/config/redis.js'

type RedisRole =
  | 'general'
  | 'bullmq-producer'
  | 'bullmq-worker'
  | 'socket-publisher'
  | 'socket-subscriber'

const clients = new Map<string, Redis>()

function buildRedisOptions(role: RedisRole): RedisOptions {
  return {
    lazyConnect: true,
    connectTimeout: redisConfig.connectTimeoutMs,
    keyPrefix: role.startsWith('bullmq') ? undefined : `${redisConfig.keyPrefix}:`,
    maxRetriesPerRequest:
      role === 'bullmq-worker' ? null : redisConfig.maxRetriesPerRequest,
    enableReadyCheck: true
  }
}

function registerListeners(client: Redis, role: RedisRole) {
  client.on('connect', () => {
    logger.info({ redisRole: role }, 'Redis connected')
  })

  client.on('ready', () => {
    logger.info({ redisRole: role }, 'Redis ready')
  })

  client.on('reconnecting', () => {
    logger.warn({ redisRole: role }, 'Redis reconnecting')
  })

  client.on('error', error => {
    logger.error(
      {
        redisRole: role,
        error: error instanceof Error ? error.message : 'Redis error'
      },
      'Redis connection error'
    )
  })
}

export function createRedisConnection(role: RedisRole) {
  if (!redisConfig.enabled || !redisConfig.url) {
    return null
  }

  const client = new Redis(redisConfig.url, buildRedisOptions(role))
  registerListeners(client, role)
  return client
}

export async function getRedisClient(role: RedisRole = 'general') {
  if (!redisConfig.enabled || !redisConfig.url) {
    return null
  }

  const existing = clients.get(role)

  if (existing) {
    return existing
  }

  const client = createRedisConnection(role)

  if (!client) {
    return null
  }

  clients.set(role, client)
  await client.connect()
  return client
}

export async function pingRedis() {
  if (!redisConfig.enabled) {
    return {
      enabled: false,
      status: 'disabled' as const,
      latencyMs: null
    }
  }

  const startedAt = Date.now()

  try {
    const client = await getRedisClient('general')

    if (!client) {
      return {
        enabled: true,
        status: 'unavailable' as const,
        latencyMs: null
      }
    }

    await client.ping()

    return {
      enabled: true,
      status: 'ok' as const,
      latencyMs: Date.now() - startedAt
    }
  } catch {
    return {
      enabled: true,
      status: 'unavailable' as const,
      latencyMs: null
    }
  }
}

export async function closeRedisConnections() {
  await Promise.allSettled(
    Array.from(clients.values()).map(async client => {
      await client.quit()
    })
  )
  clients.clear()
}
