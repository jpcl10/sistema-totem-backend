import { z } from 'zod'

export const createNfcCardSchema = z.object({
  uid: z.string().min(1),
  code: z.string().optional(),
  holderName: z.string().optional(),
  type: z.enum(['CUSTOMER', 'STAFF', 'VIP', 'COMANDA']).default('CUSTOMER'),
  metadata: z.record(z.string(), z.any()).optional()
})
