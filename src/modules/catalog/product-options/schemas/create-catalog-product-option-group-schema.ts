import { z } from 'zod'

export const createCatalogProductOptionGroupSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0),
  maxSelections: z.number().int().min(1),
  sortOrder: z.number().int().min(0).default(0)
})
