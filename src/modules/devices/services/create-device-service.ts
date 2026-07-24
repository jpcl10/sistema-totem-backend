import {
  randomBytes,
  createHash
} from 'node:crypto'

import {
  DeviceStatus,
  DeviceType,
  AuditAction,
  UserRole,
  Prisma
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface CreateDeviceServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  eventId?: string
  storeId?: string
  name: string
  code: string
  type: DeviceType
  locationName?: string
  metadata?: Prisma.InputJsonValue | null
}

function generateDeviceSecret() {
  return `dvs_${randomBytes(32).toString('hex')}`
}

function hashSecret(secret: string) {
  return createHash('sha256')
    .update(secret)
    .digest('hex')
}

export class CreateDeviceService {
  async execute({
    organizationId,
    userId,
    eventId,
    storeId,
    name,
    code,
    type,
    locationName,
    metadata
  }: CreateDeviceServiceRequest) {
    const normalizedCode =
      code.trim().toUpperCase()

    const deviceWithSameCode =
      await prisma.device.findUnique({
        where: {
          code: normalizedCode
        }
      })

    if (deviceWithSameCode) {
      throw new Error('Device code already exists')
    }

    if (eventId) {
      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
          organizationId
        },
        select: {
          id: true
        }
      })

      if (!event) {
        throw new Error('Event not found')
      }
    }

    if (storeId) {
      const store = await prisma.onlineStore.findFirst({
        where: {
          id: storeId,
          organizationId
        },
        select: {
          id: true
        }
      })

      if (!store) {
        throw new Error('Store not found')
      }
    }

    const deviceSecret = generateDeviceSecret()
    const deviceSecretHash = hashSecret(deviceSecret)

    const device = await prisma.device.create({
      data: {
        organizationId,
        eventId: eventId ?? null,
        storeId: eventId ? null : storeId ?? null,
        name: name.trim(),
        code: normalizedCode,
        type,
        status: DeviceStatus.ACTIVE,
        deviceSecretHash,
        locationName: locationName?.trim() || null,
        metadata: metadata ?? undefined
      }
    })

    // Create audit log for device created
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      eventId: eventId ?? null,
      userId,
      entity: 'Device',
      entityId: device.id,
      action: AuditAction.DEVICE_CREATED,
      description: 'Dispositivo criado',
      metadata: {
        deviceId: device.id,
        code: device.code,
        name: device.name,
        type: device.type
      }
    })

    return {
      device,
      deviceSecret
    }
  }
}
