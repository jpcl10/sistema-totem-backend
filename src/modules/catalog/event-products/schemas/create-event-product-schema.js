import { z } from 'zod';
export const createEventProductSchema = z.object({
    catalogProductId: z.string().min(1),
    priceInCents: z.number().int().min(0).nullable().optional(),
    active: z.boolean().optional(),
    trackStock: z.boolean().optional(),
    stockQuantity: z.number()
        .int()
        .min(0)
        .nullable()
        .optional()
});
