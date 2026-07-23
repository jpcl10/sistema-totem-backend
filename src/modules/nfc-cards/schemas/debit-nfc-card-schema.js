import { z } from 'zod';
export const debitNfcCardSchema = z.object({
    amountInCents: z.number().int().positive(),
    description: z.string().optional()
});
