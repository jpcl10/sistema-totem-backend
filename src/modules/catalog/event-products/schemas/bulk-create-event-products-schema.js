import { z } from 'zod';
const bulkEventProductSchema = z.object({
    catalogProductId: z.string().min(1),
    priceInCents: z.number().int().min(0).nullable().optional(),
    active: z.boolean().default(true),
    trackStock: z.boolean().default(false),
    stockQuantity: z.number().int().min(0).nullable().optional()
});
export const bulkCreateEventProductsSchema = z.object({
    products: z.array(bulkEventProductSchema).min(1)
});
