import { z } from 'zod';
export const updateOrderStatusSchema = z.object({
    status: z.enum([
        'CONFIRMED',
        'PREPARING',
        'READY',
        'DELIVERED',
        'CANCELLED'
    ]),
    cancelReason: z.string()
        .optional()
        .nullable(),
    restoreStock: z.boolean()
        .optional()
});
