import { z } from 'zod'

export const deviceHeartbeatSchema =
  z.object({
    appVersion: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })