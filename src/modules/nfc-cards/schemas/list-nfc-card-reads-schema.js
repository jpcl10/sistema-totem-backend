import { z } from 'zod';
export const listNfcCardReadsSchema = z.object({
    page: z.string().optional().default('1').transform(Number),
    limit: z.string().optional().default('20').transform(Number)
});
