import { z } from 'zod'

export const createEventProductSchema = z.object({
  catalogProductId: z.string().min(1),
  priceInCents: z.number().int().positive()
})