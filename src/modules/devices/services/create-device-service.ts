import {
  DeviceStatus,
  DeviceType
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface CreateDeviceServiceRequest {
  organizationId: string
  eventId?: string | null
  name: string
  code: string
  type: DeviceType
  locationName?: string | null
}

export class CreateDeviceService {
  async execute({
    organizationId,
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

    return {
      device
    }
  }
}