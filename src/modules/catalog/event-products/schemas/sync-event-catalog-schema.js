import { z } from 'zod';
export const syncEventCatalogQuerySchema = z.object({
    dryRun: z.coerce.boolean().default(false)
});
