import { z } from 'zod';
export const updateOrderPaymentStatusSchema = z.object({
    paymentStatus: z.enum([
        'NOT_REQUIRED',
        'PENDING',
        'PAID',
        'FAILED'
    ])
});
