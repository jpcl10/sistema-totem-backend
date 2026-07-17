import { z } from 'zod'

export const updateCatalogCategorySchema = z.object({
  name: z.string().min(2).optional(),

  slug: z.string().min(2).optional(),

  sector: z.enum([
    'BAR',
    'KITCHEN'
  ]).optional(),

  active: z.boolean().optional(),
  
  sortOrder: z.number().int().min(0).optional()
})