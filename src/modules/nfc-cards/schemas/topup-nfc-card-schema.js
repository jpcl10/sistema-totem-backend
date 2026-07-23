import { z } from 'zod';
export const topupNfcCardSchema = z.object({
    amountInCents: z.number().int().positive(),
    description: z.string().optional()
});
