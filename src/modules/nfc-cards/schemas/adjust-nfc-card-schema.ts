import { z } from 'zod'

export const adjustNfcCardSchema = z.object({
  newBalanceInCents: z.number().int().min(0),
  description: z.string().optional()
})
