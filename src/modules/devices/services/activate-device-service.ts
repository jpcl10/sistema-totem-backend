import { createHash } from 'node:crypto'

import {
  DeviceAuthStatus,
  DeviceStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'

interface ActivateDeviceServiceRequest {
  code: string
  secret: string
  appVersion?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

function hashValue(value: string) {
  return createHash('sha256')
    .update(value)
    .digest('hex')
}

export class ActivateDeviceService {
  async execute({
    code,
    secret,
    appVersion,
    ipAddress,
    userAgent
  }: ActivateDeviceServiceRequest) {
    const normalizedCode =
      code.trim().toUpperCase()

    const device =
      await prisma.device.findUnique({
        where: {
          code: normalizedCode
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })

    if (!device) {
      throw new Error('Device not found')
    }

    if (device.authStatus === DeviceAuthStatus.REVOKED) {
      throw new Error('Device credentials revoked')
    }

    if (device.status === DeviceStatus.MAINTENANCE) {
      throw new Error('Device is under maintenance')
    }

    if (!device.deviceSecretHash) {
      throw new Error('Device credentials not generated')
    }

    const secretHash =
      hashValue(secret)

    if (secretHash !== device.deviceSecretHash) {
      throw new Error('Invalid device credentials')
    }

    const jwt =
      await import('jsonwebtoken')

    const jwtSecret =
      process.env.JWT_SECRET

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not set.')
    }

    const deviceToken =
      jwt.default.sign(
        {
          type: 'device',
          deviceId: device.id,
          organizationId: device.organizationId,
          eventId: device.eventId,
          deviceType: device.type
        },
        jwtSecret,
        {
          subject: device.id,
          expiresIn: '30d'
        }
      )

    const tokenHash =
      hashValue(deviceToken)

    const now = new Date()

    const updatedDevice =
      await prisma.device.update({
        where: {
          id: device.id
        },
        data: {
          tokenHash,
          authStatus: DeviceAuthStatus.ACTIVE,
          lastActivatedAt: now,
          lastSeenAt: now,
          appVersion: appVersion ?? device.appVersion,
          lastIpAddress: ipAddress ?? device.lastIpAddress,
          lastUserAgent: userAgent ?? device.lastUserAgent
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })

    return {
      deviceToken,
      device: updatedDevice,
      config: {
        apiBaseUrl: null,
        eventId: updatedDevice.eventId,
        eventSlug: updatedDevice.event?.slug ?? null,
        eventName: updatedDevice.event?.name ?? null,
        deviceCode: updatedDevice.code,
        deviceType: updatedDevice.type,
        autoPrintEnabled:
          updatedDevice.type === 'SK210' ||
          updatedDevice.type === 'PRINTER'
      }
    }
  }
}