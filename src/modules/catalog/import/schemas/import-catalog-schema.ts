import { z } from 'zod'

export const importCatalogOptionSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().nullable().optional(),
  priceDeltaInCents: z.number().int().min(0),
  linkedProductSlug: z.string().nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0)
})

export const importCatalogOptionGroupSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().nullable().optional(),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0),
  maxSelections: z.number().int().min(1),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  options: z.array(importCatalogOptionSchema)
})

export const importCatalogProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  categorySlug: z.string().min(1),
  description: z.string().nullable().optional(),
  priceInCents: z.number().int().min(0),
  imageUrl: z.string().nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  optionGroups: z.array(importCatalogOptionGroupSchema)
})

export const importCatalogCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  sector: z.enum(['BAR', 'KITCHEN']).default('KITCHEN'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0)
})

export const importCatalogSchema = z.object({
  dryRun: z.boolean().default(false),
  categories: z.array(importCatalogCategorySchema),
  products: z.array(importCatalogProductSchema)
})

export type ImportCatalogOption = z.infer<typeof importCatalogOptionSchema>
export type ImportCatalogOptionGroup = z.infer<typeof importCatalogOptionGroupSchema>
export type ImportCatalogProduct = z.infer<typeof importCatalogProductSchema>
export type ImportCatalogCategory = z.infer<typeof importCatalogCategorySchema>
export type ImportCatalogRequest = z.infer<typeof importCatalogSchema>
