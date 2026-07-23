import { z } from 'zod';
export const getOnlineStoreParamsSchema = z.object({
    id: z.string().min(1)
});
