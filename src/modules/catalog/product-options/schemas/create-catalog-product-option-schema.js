import { z } from 'zod';
export const createCatalogProductOptionSchema = z.object({
    name: z.string().min(1),
    key: z.string().min(1),
    description: z.string().optional(),
    priceDeltaInCents: z.number().int().min(0),
    linkedProductId: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0)
});
