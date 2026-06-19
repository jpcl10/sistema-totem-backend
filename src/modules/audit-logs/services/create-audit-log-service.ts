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
        metadata: metadata ?? undefined
      }
    })

    return {
      auditLog
    }
  }
}