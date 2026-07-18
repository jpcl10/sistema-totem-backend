import {
  AuditAction,
  Prisma
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { logger } from '../../../lib/logger.js'

interface CreateAuditLogServiceRequest {
  organizationId: string
  eventId?: string | null
  userId?: string | null
  deviceId?: string | null
  entity: string
  entityId?: string | null
  action: AuditAction
  description?: string | null
  metadata?: Prisma.InputJsonValue | null
}

const sensitiveKeyPattern =
  /(accessToken|refreshToken|token|secret|password|senha|privateKey|authorization|cardNumber|cvv|encryptedCredentials)/i

function sanitizeAuditMetadataValue(
  value: unknown
): Prisma.InputJsonValue | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeAuditMetadataValue(item) ?? null) as Prisma.InputJsonArray
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, Prisma.InputJsonValue | null> = {}

    for (const [key, nestedValue] of Object.entries(value)) {
      if (sensitiveKeyPattern.test(key)) {
        sanitized[key] = '[REDACTED]'
        continue
      }

      const sanitizedValue = sanitizeAuditMetadataValue(nestedValue)
      if (sanitizedValue !== undefined) {
        sanitized[key] = sanitizedValue
      }
    }

    return sanitized as Prisma.InputJsonObject
  }

  return undefined
}

export function sanitizeAuditMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  const sanitized = sanitizeAuditMetadataValue(value)
  return sanitized === null
    ? undefined
    : sanitized
}

export class CreateAuditLogService {
  async execute({
    organizationId,
    eventId,
    userId,
    deviceId,
    entity,
    entityId,
    action,
    description,
    metadata
  }: CreateAuditLogServiceRequest) {
    // Step 1: Verify organization exists (required)
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    })

    if (!organization) {
      throw new Error('Organization not found')
    }

    // Step 2: Validate optional fields
    let validatedEventId: string | null = null
    let validatedUserId: string | null = null
    let validatedDeviceId: string | null = null

    if (eventId) {
      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
          organizationId
        }
      })

      if (event) {
        validatedEventId = eventId
      } else {
        logger.warn({ eventId, organizationId }, 'Invalid eventId for audit log, setting to null')
      }
    }

    if (userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          organizationId
        }
      })

      if (user) {
        validatedUserId = userId
      } else {
        logger.warn({ userId, organizationId }, 'Invalid userId for audit log, setting to null')
      }
    }

    if (deviceId) {
      const device = await prisma.device.findFirst({
        where: {
          id: deviceId,
          organizationId
        }
      })

      if (device) {
        validatedDeviceId = deviceId
      } else {
        logger.warn({ deviceId, organizationId }, 'Invalid deviceId for audit log, setting to null')
      }
    }

    // Step 3: Create audit log with validated data
    const auditLog = await prisma.auditLog.create({
      data: {
        organizationId,
        eventId: validatedEventId,
        userId: validatedUserId,
        deviceId: validatedDeviceId,
        entity,
        entityId: entityId ?? null,
        action,
        description: description ?? null,
        metadata: sanitizeAuditMetadata(metadata)
      }
    })

    return {
      auditLog
    }
  }
}
