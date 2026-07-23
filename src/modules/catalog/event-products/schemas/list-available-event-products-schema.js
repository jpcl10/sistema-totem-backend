import { z } from 'zod';
const booleanFromQuerySchema = z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform(value => {
    if (value === undefined) {
        return undefined;
    }
    return value === true || value === 'true';
});
export const listAvailableEventProductsQuerySchema = z.object({
    search: z.string().trim().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    active: booleanFromQuerySchema.default(true),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50)
});
