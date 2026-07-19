import { z } from 'zod'

const processingModes = ['BULLMQ', 'LEGACY_POLLING', 'DISABLED'] as const

const boolSchema = z
  .string()
  .optional()
  .transform(value => value === 'true')

function parseIntegerEnv(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid integer env value: ${value}`)
  }

  return parsed
}

function sanitizePrefix(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, '-')
}

const redisEnabled = boolSchema.parse(process.env.REDIS_ENABLED)
const redisUrl = process.env.REDIS_URL?.trim() || undefined
const nodeEnv = process.env.NODE_ENV || 'development'

if (nodeEnv === 'production' && redisEnabled && !redisUrl) {
  throw new Error('REDIS_URL is required when REDIS_ENABLED=true in production')
}

if (redisEnabled && !redisUrl) {
  throw new Error('REDIS_URL is required when REDIS_ENABLED=true')
}

const defaultKeyPrefix = sanitizePrefix(`defumar:${nodeEnv}`)
const configuredMode =
  (process.env.PRINT_PROCESSING_MODE as typeof processingModes[number] | undefined) ??
  (redisEnabled ? 'BULLMQ' : 'LEGACY_POLLING')

if (!processingModes.includes(configuredMode)) {
  throw new Error(`Invalid PRINT_PROCESSING_MODE value: ${configuredMode}`)
}

if (!redisEnabled && configuredMode === 'BULLMQ') {
  throw new Error('PRINT_PROCESSING_MODE=BULLMQ requires REDIS_ENABLED=true')
}

export const redisConfig = {
  enabled: redisEnabled,
  url: redisUrl,
  keyPrefix: sanitizePrefix(process.env.REDIS_KEY_PREFIX || defaultKeyPrefix),
  connectTimeoutMs: parseIntegerEnv(
    process.env.REDIS_CONNECT_TIMEOUT_MS,
    10_000
  ),
  maxRetriesPerRequest: parseIntegerEnv(
    process.env.REDIS_MAX_RETRIES_PER_REQUEST,
    2
  )
}

export const printProcessingConfig = {
  configuredMode,
  redisFailureGraceMs: parseIntegerEnv(
    process.env.PRINT_REDIS_FAILURE_GRACE_MS,
    30_000
  ),
  concurrency: Math.max(
    1,
    parseIntegerEnv(process.env.PRINT_QUEUE_CONCURRENCY, 2)
  ),
  jobTimeoutMs: Math.max(
    1_000,
    parseIntegerEnv(process.env.PRINT_JOB_TIMEOUT_MS, 30_000)
  ),
  staleLockMs: Math.max(
    5_000,
    parseIntegerEnv(process.env.PRINT_JOB_STALE_LOCK_MS, 120_000)
  ),
  pollingIntervalMs: Math.max(
    1_000,
    parseIntegerEnv(process.env.PRINT_LEGACY_POLLING_INTERVAL_MS, 3_000)
  )
}

export function getSanitizedRedisConfig() {
  return {
    enabled: redisConfig.enabled,
    keyPrefix: redisConfig.keyPrefix,
    connectTimeoutMs: redisConfig.connectTimeoutMs,
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest
  }
}
