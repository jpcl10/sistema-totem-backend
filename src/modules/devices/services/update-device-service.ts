import {
  DeviceStatus,
  DeviceType,
  UserRole,
  Prisma
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface UpdateDeviceServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  deviceId: string

  name?: string
  eventId?: string
  storeId?: string
  locationName?: string
  metadata?: Prisma.InputJsonValue | null

  status?: DeviceStatus
  type?: DeviceType
}

export class UpdateDeviceService {
  async execute({
    organizationId,
    deviceId,
    name,
    eventId,
    storeId,
    locationName,
    metadata,
    status,
    type
  }: UpdateDeviceServiceRequest) {
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        organizationId
      }
    })

    if (!device) {
      throw new Error('Device not found')
    }

    if (eventId) {
      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
          organizationId
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
        }
      })

      if (!store) {
        throw new Error('Store not found')
      }
    }

    const updatedDevice =
      await prisma.device.update({
        where: {
          id: deviceId
        },
        data: {
          name: name?.trim(),
          eventId: eventId ? eventId : storeId ? null : undefined,
          storeId: storeId ? storeId : eventId ? null : undefined,
          locationName,
          metadata: metadata ?? undefined,
          status,
          type
        }
      })

    return {
      device: updatedDevice
    }
  }
}
