import { z } from 'zod'

export const updateEventProductSchema = z.object({
  priceInCents: z.number().int().min(0).nullable().optional(),

  trackStock: z.boolean().optional(),

  stockQuantity: z.number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),

  soldOut: z.boolean().optional(),

  active: z.boolean().optional()
})
