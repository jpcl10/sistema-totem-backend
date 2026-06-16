import {
  AuditAction,
  Prisma
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

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
    const auditLog = await prisma.auditLog.create({
      data: {
        organizationId,
        eventId: eventId ?? null,
        userId: userId ?? null,
        deviceId: deviceId ?? null,
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