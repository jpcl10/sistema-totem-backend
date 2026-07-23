import { z } from 'zod';
import { r2UrlSchema } from '../../../shared/utils/r2-url-schema.js';
export const updateEventSchema = z.object({
    name: z.string().min(2).optional(),
    slug: z.string().min(2).optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    logoUrl: r2UrlSchema
        .optional()
        .nullable(),
    bannerUrl: r2UrlSchema
        .optional()
        .nullable(),
    totemWelcomeMessage: z.string()
        .optional()
        .nullable(),
    totemBackgroundColor: z.string()
        .optional()
        .nullable(),
    totemTextColor: z.string()
        .optional()
        .nullable(),
    totemShowPrices: z.boolean().optional(),
    totemShowLowStock: z.boolean().optional(),
    totemRequireCustomerName: z.boolean().optional(),
    totemAutoResetSeconds: z.number()
        .int()
        .positive()
        .optional(),
    totemShowLogo: z.boolean().optional(),
    totemFullscreenRecommended: z.boolean().optional(),
    pixEnabled: z.boolean().optional(),
    pixKey: z.string()
        .optional()
        .nullable(),
    pixReceiverName: z.string()
        .optional()
        .nullable(),
    pixCity: z.string()
        .optional()
        .nullable(),
    pixInstructions: z.string()
        .optional()
        .nullable(),
    pixPaymentExpirationMinutes: z.number()
        .int()
        .min(2)
        .max(15)
        .optional(),
    printingEnabled: z.boolean().optional(),
    autoPrintEnabled: z.boolean().optional(),
    printMode: z.enum([
        'FULL_ORDER',
        'BY_SECTOR',
        'BOTH'
    ]).optional(),
    printerPaperSize: z.enum([
        '58mm',
        '80mm'
    ]).optional(),
    active: z.boolean().optional(),
    startsAt: z.coerce.date()
        .optional()
        .nullable(),
    endsAt: z.coerce.date()
        .optional()
        .nullable()
});
