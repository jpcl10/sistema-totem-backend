import { z } from 'zod'

import { r2UrlSchema } from '../../../shared/utils/r2-url-schema.js'

const colorSchema = z.string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must use #RRGGBB format')

export const settingsChannelSchema = z.enum([
  'ALL',
  'DELIVERY',
  'PICKUP',
  'DIGITAL_MENU',
  'TOTEM',
  'COUNTER'
])

export const settingsContextTypeSchema = z.enum([
  'ORGANIZATION',
  'ONLINE_STORE'
])

export const timeSchema = z.string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format')

export const getSettingsQuerySchema = z.object({
  storeId: z.string().cuid().optional(),
  eventId: z.string().cuid().optional(),
  deviceId: z.string().cuid().optional(),
  channel: settingsChannelSchema.optional(),
  date: z.coerce.date().optional()
})

export const updateGeneralSettingsSchema = z.object({
  legalName: z.string().trim().min(1).nullable().optional(),
  document: z.string().trim().min(1).nullable().optional(),
  contactEmail: z.string().trim().email().nullable().optional(),
  contactPhone: z.string().trim().min(1).nullable().optional(),
  whatsapp: z.string().trim().min(1).nullable().optional(),
  address: z.string().trim().min(1).nullable().optional(),
  city: z.string().trim().min(1).nullable().optional(),
  state: z.string().trim().min(1).nullable().optional(),
  postalCode: z.string().trim().min(1).nullable().optional(),
  timezone: z.string().trim().min(1).optional(),
  locale: z.string().trim().min(1).optional(),
  currency: z.string().trim().length(3).optional()
})

export const updateBrandingSettingsSchema = z.object({
  logoUrl: r2UrlSchema.nullable().optional(),
  lightLogoUrl: r2UrlSchema.nullable().optional(),
  darkLogoUrl: r2UrlSchema.nullable().optional(),
  faviconUrl: r2UrlSchema.nullable().optional(),
  bannerDesktopUrl: r2UrlSchema.nullable().optional(),
  bannerMobileUrl: r2UrlSchema.nullable().optional(),
  socialImageUrl: r2UrlSchema.nullable().optional(),
  primaryColor: colorSchema.nullable().optional(),
  secondaryColor: colorSchema.nullable().optional(),
  backgroundColor: colorSchema.nullable().optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  defaultProductImageUrl: r2UrlSchema.nullable().optional()
})

export const getBusinessHoursQuerySchema = z.object({
  contextType: settingsContextTypeSchema.optional(),
  storeId: z.string().cuid().optional(),
  channel: settingsChannelSchema.optional()
})

const businessHourInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  periodIndex: z.number().int().min(0),
  opensAt: timeSchema.optional(),
  closesAt: timeSchema.optional(),
  isClosed: z.boolean().default(false),
  is24Hours: z.boolean().default(false)
})

export const upsertBusinessHoursSchema = z.object({
  contextType: settingsContextTypeSchema.default('ORGANIZATION'),
  storeId: z.string().cuid().nullable().optional(),
  channel: settingsChannelSchema.default('ALL'),
  hours: z.array(businessHourInputSchema)
})

export const businessHourExceptionParamsSchema = z.object({
  exceptionId: z.string().cuid()
})

export const createBusinessHourExceptionSchema = z.object({
  storeId: z.string().cuid().nullable().optional(),
  channel: settingsChannelSchema.default('ALL'),
  date: z.coerce.date(),
  isClosed: z.boolean().default(false),
  is24Hours: z.boolean().default(false),
  opensAt: timeSchema.nullable().optional(),
  closesAt: timeSchema.nullable().optional(),
  reason: z.string().trim().min(1).nullable().optional()
})

export const updateBusinessHourExceptionSchema =
  createBusinessHourExceptionSchema.partial()

export const storeSettingsQuerySchema = z.object({
  storeId: z.string().cuid()
})

export const updateOnlineOrderSettingsSchema = z.object({
  onlineOrderingEnabled: z.boolean().optional(),
  digitalMenuEnabled: z.boolean().optional(),
  autoAcceptOrders: z.boolean().optional(),
  minimumOrderInCents: z.number().int().min(0).optional(),
  estimatedPreparationMinutes: z.number().int().min(0).optional(),
  allowOrdersOutsideHours: z.boolean().optional(),
  closedMessage: z.string().trim().min(1).nullable().optional(),
  checkoutNotice: z.string().trim().min(1).nullable().optional(),
  orderConfirmationMessage: z.string().trim().min(1).nullable().optional(),
  requireCustomerName: z.boolean().optional(),
  requireCustomerPhone: z.boolean().optional(),
  allowCustomerNotes: z.boolean().optional()
})

export const updateDeliverySettingsSchema = z.object({
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  counterEnabled: z.boolean().optional(),
  dineInEnabled: z.boolean().optional(),
  allowOrdersOutsideHours: z.boolean().optional(),
  estimatedDeliveryMinutes: z.number().int().min(0).optional(),
  freeDeliveryAboveInCents: z.number().int().min(0).nullable().optional(),
  defaultDeliveryFeeInCents: z.number().int().min(0).optional(),
  requireDeliveryAddress: z.boolean().optional()
})

export const deliveryFeeRuleParamsSchema = z.object({
  ruleId: z.string().cuid()
})

const deliveryFeeRuleInputSchema = z.object({
  storeId: z.string().cuid(),
  name: z.string().trim().min(1),
  type: z.enum(['FLAT', 'NEIGHBORHOOD']),
  neighborhood: z.string().trim().min(1).nullable().optional(),
  feeInCents: z.number().int().min(0),
  estimatedMinutes: z.number().int().min(0).nullable().optional(),
  minimumOrderInCents: z.number().int().min(0).nullable().optional(),
  freeDeliveryAboveInCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0)
})

export const createDeliveryFeeRuleSchema = deliveryFeeRuleInputSchema
  .superRefine((data, ctx) => {
    if (data.type === 'NEIGHBORHOOD' && !data.neighborhood) {
      ctx.addIssue({
        code: 'custom',
        path: ['neighborhood'],
        message: 'neighborhood is required for NEIGHBORHOOD delivery rules'
      })
    }

    if (data.type === 'FLAT' && data.neighborhood) {
      ctx.addIssue({
        code: 'custom',
        path: ['neighborhood'],
        message: 'neighborhood is not allowed for FLAT delivery rules'
      })
    }
  })

export const updateDeliveryFeeRuleSchema =
  deliveryFeeRuleInputSchema
    .omit({ storeId: true })
    .partial()
    .superRefine((data, ctx) => {
      if (data.type === 'NEIGHBORHOOD' && data.neighborhood === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['neighborhood'],
          message: 'neighborhood is required for NEIGHBORHOOD delivery rules'
        })
      }
    })

const printModeSchema = z.enum([
  'FULL_ORDER',
  'BY_SECTOR',
  'BOTH'
])

const printingSourceSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoPrint: z.boolean().optional(),
  printMode: printModeSchema.optional()
})

export const updatePrintingSettingsSchema = z.object({
  printingEnabled: z.boolean().optional(),
  autoPrintEnabled: z.boolean().optional(),
  allowReprint: z.boolean().optional(),
  splitBySector: z.boolean().optional(),
  mergeCopies: z.boolean().optional(),
  defaultPrinterDeviceId: z.string().cuid().nullable().optional(),
  kitchenPrinterDeviceId: z.string().cuid().nullable().optional(),
  barPrinterDeviceId: z.string().cuid().nullable().optional(),
  expeditionPrinterDeviceId: z.string().cuid().nullable().optional(),
  paperSize: z.enum(['58mm', '80mm']).optional(),
  showLogo: z.boolean().optional(),
  showPrices: z.boolean().optional(),
  showQrCode: z.boolean().optional(),
  showPayment: z.boolean().optional(),
  showOrderSource: z.boolean().optional(),
  showOrderNotes: z.boolean().optional(),
  showItemNotes: z.boolean().optional(),
  showOptions: z.boolean().optional(),
  sources: z.object({
    ONLINE_STORE: printingSourceSettingsSchema.optional(),
    MANUAL_STORE: printingSourceSettingsSchema.optional(),
    EVENT: printingSourceSettingsSchema.optional(),
    MANUAL_EVENT: printingSourceSettingsSchema.optional(),
    TOTEM: printingSourceSettingsSchema.optional(),
    POS: printingSourceSettingsSchema.optional(),
    API: printingSourceSettingsSchema.optional(),
    WAITER: printingSourceSettingsSchema.optional()
  }).partial().optional(),
  sectors: z.object({
    COOK: z.object({ enabled: z.boolean().optional() }).optional(),
    BAR: z.object({ enabled: z.boolean().optional() }).optional(),
    GENERAL: z.object({ enabled: z.boolean().optional() }).optional()
  }).partial().optional()
})
