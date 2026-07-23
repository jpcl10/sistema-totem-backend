import { z } from 'zod';
export const getPublicStoreParamsSchema = z.object({
    slug: z.string().min(1)
});
