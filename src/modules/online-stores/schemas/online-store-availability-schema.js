import { z } from 'zod';
export const onlineStoreAvailabilityParamsSchema = z.object({
    storeId: z.string().min(1)
});
export const updateOnlineStoreAvailabilitySchema = z.object({
    mode: z.enum(['AUTO', 'FORCE_OPEN', 'FORCE_CLOSED']),
    until: z.string().datetime().nullable().optional(),
    reason: z.string().trim().max(300).nullable().optional()
});
