import 'fastify'
import { DeviceType, UserRole } from '@prisma/client'
import {
  PlatformContext,
  TenantContext
} from '../modules/auth/middlewares/request-context.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      sub: string
      role: UserRole
      organizationId: string
      sessionVersion: number
    }

    device: {
      sub: string
      deviceId: string
      organizationId: string
      eventId: string | null
      deviceType: DeviceType
    }

    platformContext?: PlatformContext
    tenantContext?: TenantContext
  }
}
