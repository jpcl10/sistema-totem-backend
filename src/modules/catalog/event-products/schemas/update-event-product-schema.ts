import { z } from 'zod'

export const updateEventProductSchema = z.object({
  priceInCents: z.number().int().positive().optional(),

  trackStock: z.boolean().optional(),

  stockQuantity: z.number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),

  soldOut: z.boolean().optional(),

  active: z.boolean().optional()
})