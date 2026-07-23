import { z } from 'zod';
export const identifyNfcCardSchema = z.object({
    uid: z.string().min(1)
});
