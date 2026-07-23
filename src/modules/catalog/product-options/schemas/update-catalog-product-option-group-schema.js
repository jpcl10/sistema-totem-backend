import { z } from 'zod';
export const updateCatalogProductOptionGroupSchema = z.object({
    name: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    minSelections: z.number().int().min(0).optional(),
    maxSelections: z.number().int().min(1).optional(),
    sortOrder: z.number().int().min(0).optional()
});
