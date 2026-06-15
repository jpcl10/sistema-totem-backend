import 'fastify'
import { DeviceType } from '@prisma/client'

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      sub: string
      role: string
      organizationId: string
    }

    device: {
      sub: string
      deviceId: string
      organizationId: string
      eventId: string | null
      deviceType: DeviceType
    }
  }
}