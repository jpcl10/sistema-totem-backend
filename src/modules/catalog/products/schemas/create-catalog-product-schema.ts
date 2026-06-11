import { z } from 'zod'

export const createCatalogProductSchema =
  z.object({
    categoryId: z.string(),

    name: z.string().min(2),

    slug: z.string().min(2),

    description: z.string().optional(),

    imageUrl: z.string().optional()
  })