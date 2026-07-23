import { z } from 'zod';
import { r2UrlSchema } from '../../../shared/utils/r2-url-schema.js';
export const createEventSchema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    logoUrl: r2UrlSchema.optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional()
});
