import { z } from 'zod'

export const createCatalogCategorySchema = z.object({
  name: z.string().min(2),

  slug: z.string().min(2),

  sector: z.enum([
    'BAR',
    'KITCHEN'
  ]).optional(),
  
  sortOrder: z.number().int().min(0).optional()
})