import { z } from 'zod'
import { AuditAction } from '@prisma/client'

export const listEventAuditLogsParamsSchema = z.object({
  eventId: z.string().min(1)
})

export const listEventAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.nativeEnum(AuditAction).optional(),
  entity: z.string().optional(),
  userId: z.string().optional(),
  deviceId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
})
