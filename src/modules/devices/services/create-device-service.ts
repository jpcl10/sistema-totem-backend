import {
  DeviceStatus,
  DeviceType,
  AuditAction,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface CreateDeviceServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string
  eventId?: string | null
  name: string
  code: string
  type: DeviceType
  locationName?: string | null
}

export class CreateDeviceService {
  async execute({
    organizationId,
    userId,
    eventId,
    name,
    code,
    type,
    locationName
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

    const device = await prisma.device.create({
      data: {
        organizationId,
        eventId: eventId ?? null,
        name: name.trim(),
        code: normalizedCode,
        type,
        status: DeviceStatus.ACTIVE,
        locationName: locationName?.trim() || null
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
      device
    }
  }
}
