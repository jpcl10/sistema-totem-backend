import { z } from 'zod'

export const createOnlineStoreSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  whatsapp: z.string().min(1),
  city: z.string().min(1),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  isOpen: z.boolean().default(true),
  active: z.boolean().default(true)
})
