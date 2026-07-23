import { z } from 'zod';
export const listOnlineOrdersParamsSchema = z.object({
    storeId: z.string().min(1)
});
