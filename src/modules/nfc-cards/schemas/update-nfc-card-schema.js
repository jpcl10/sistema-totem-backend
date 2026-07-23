import { z } from 'zod';
export const updateNfcCardSchema = z.object({
    code: z.string().optional(),
    holderName: z.string().optional(),
    type: z.enum(['CUSTOMER', 'STAFF', 'VIP', 'COMANDA']).optional(),
    status: z.enum(['ACTIVE', 'BLOCKED', 'LOST']).optional(),
    metadata: z.record(z.string(), z.any()).optional()
});
