import { z } from 'zod'

export const updateCatalogProductOptionSchema = z.object({
  name: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  description: z.string().optional(),
  priceDeltaInCents: z.number().int().min(0).optional(),
  linkedProductId: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional()
})
