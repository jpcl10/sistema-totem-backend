import { z } from 'zod'

import { r2UrlSchema } from '../../../../shared/utils/r2-url-schema.js'

export const createCatalogProductSchema =
  z.object({
    categoryId: z.string(),

    name: z.string().min(2),

    slug: z.string().min(2),

    description: z.string().optional(),

    imageUrl: r2UrlSchema.optional()
  })
