import { z } from 'zod'

export const updateCatalogProductSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  active: z.boolean().optional()
})