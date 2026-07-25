import { z } from 'zod'

export const printTemplateTypeSchema = z.enum([
  'PRODUCTION',
  'CUSTOMER',
  'DELIVERY',
  'CASHIER',
  'TEST'
])

export const templatePrintModeSchema = z.enum([
  'FULL_ORDER',
  'BY_SECTOR',
  'ONE_TICKET_PER_ITEM'
])

export const printTemplatePayloadSchema = z.object({
  organizationId: z.string().min(1).nullable().optional(),
  eventId: z.string().min(1).nullable().optional(),
  printerId: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  templateType: printTemplateTypeSchema,
  paperWidthMm: z.union([z.literal(58), z.literal(80)]),
  logoUrl: z.string().url().nullable().optional(),
  logoEnabled: z.boolean().optional(),
  logoWidthPx: z.number().int().min(64).max(576).optional(),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  showOrderNumber: z.boolean().optional(),
  showDate: z.boolean().optional(),
  showTime: z.boolean().optional(),
  showOrigin: z.boolean().optional(),
  showOperator: z.boolean().optional(),
  showCustomer: z.boolean().optional(),
  showSector: z.boolean().optional(),
  showObservations: z.boolean().optional(),
  itemFontSize: z.number().int().min(1).max(3).optional(),
  titleFontSize: z.number().int().min(1).max(3).optional(),
  quantityBold: z.boolean().optional(),
  footerText: z.string().nullable().optional(),
  copies: z.number().int().min(1).max(5).optional(),
  feedLines: z.number().int().min(0).max(10).optional(),
  autoCut: z.boolean().optional(),
  printMode: templatePrintModeSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
})

export const updatePrintTemplatePayloadSchema =
  printTemplatePayloadSchema.partial()

export const resolvePrintTemplateQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  printerId: z.string().min(1).optional(),
  templateType: printTemplateTypeSchema.default('PRODUCTION')
})

export const listPrintTemplateQuerySchema = z.object({
  organizationId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  printerId: z.string().min(1).optional(),
  templateType: printTemplateTypeSchema.optional(),
  includeInactive: z.coerce.boolean().default(false)
})

export const previewPrintTemplatePayloadSchema = z.object({
  order: z.unknown().optional()
})
