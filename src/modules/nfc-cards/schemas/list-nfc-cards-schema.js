import { z } from 'zod';
export const listNfcCardsSchema = z.object({
    type: z.enum(['CUSTOMER', 'STAFF', 'VIP', 'COMANDA']).optional(),
    status: z.enum(['ACTIVE', 'BLOCKED', 'LOST']).optional()
});
