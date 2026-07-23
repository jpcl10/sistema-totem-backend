import { z } from 'zod';
export const updateOrganizationParamsSchema = z.object({
    id: z.string().min(1)
});
export const updateOrganizationSchema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    city: z.string().optional().nullable(),
    active: z.boolean().optional()
});
