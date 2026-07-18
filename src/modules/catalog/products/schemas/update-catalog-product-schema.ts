import { z } from 'zod'

import { r2UrlSchema } from '../../../../shared/utils/r2-url-schema.js'

export const updateCatalogProductSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  imageUrl: r2UrlSchema.optional().nullable(),
  active: z.boolean().optional(),
  priceInCents: z.number().int().min(0).optional(),
  pricingRule: z.enum(['STANDARD', 'MAX_SELECTED_FLAVOR']).optional(),
  supportsHalfAndHalf: z.boolean().optional(),
  canBeUsedAsFlavor: z.boolean().optional(),
  halfAndHalfFlavorCategoryId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional()
})
