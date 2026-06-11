import { z } from 'zod'

export const createEventSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),

  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  logoUrl: z.string().url().optional(),

  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional()
})