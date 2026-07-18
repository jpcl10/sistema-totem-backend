import { z } from 'zod'
import { AuditAction } from '@prisma/client'

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.nativeEnum(AuditAction).optional(),
  entity: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorUserId: z.string().optional(),
  userId: z.string().optional(),
  deviceId: z.string().optional(),
  eventId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  organizationId: z.string().optional()
})
