import { Prisma } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface DeviceHeartbeatServiceRequest {
  deviceId: string
  appVersion?: string | null
  metadata?: Prisma.InputJsonValue | null
  ipAddress?: string | null
  userAgent?: string | null
}

export class DeviceHeartbeatService {
  async execute({
    deviceId,
    appVersion,
    metadata,
    ipAddress,
    userAgent
  }: DeviceHeartbeatServiceRequest) {
    const now = new Date()

    const device =
      await prisma.device.update({
        where: {
          id: deviceId
        },
        data: {
          lastHeartbeatAt: now,
          lastSeenAt: now,

          appVersion:
            appVersion ?? undefined,

          metadata:
            metadata ?? undefined,

          lastIpAddress:
            ipAddress ?? undefined,

          lastUserAgent:
            userAgent ?? undefined
        }
      })

    return {
      success: true,
      deviceId: device.id,
      heartbeatAt: now
    }
  }
}