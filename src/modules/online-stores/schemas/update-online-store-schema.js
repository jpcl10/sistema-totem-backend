import { z } from 'zod';
export const updateOnlineStoreParamsSchema = z.object({
    id: z.string().min(1)
});
export const updateOnlineStoreSchema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    whatsapp: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    address: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    bannerUrl: z.string().optional().nullable(),
    isOpen: z.boolean().optional(),
    active: z.boolean().optional()
});
