import { z } from 'zod'

export const refundNfcCardSchema = z.object({
  amountInCents: z.number().int().positive(),
  description: z.string().optional()
})
