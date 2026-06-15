import {
  DeviceStatus,
  DeviceType
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface UpdateDeviceServiceRequest {
  organizationId: string
  deviceId: string

  name?: string
  eventId?: string | null
  locationName?: string | null

  status?: DeviceStatus
  type?: DeviceType
}

export class UpdateDeviceService {
  async execute({
    organizationId,
    deviceId,
    name,
    eventId,
    locationName,
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

    const updatedDevice =
      await prisma.device.update({
        where: {
          id: deviceId
        },
        data: {
          name: name?.trim(),
          eventId,
          locationName,
          status,
          type
        }
      })

    return {
      device: updatedDevice
    }
  }
}