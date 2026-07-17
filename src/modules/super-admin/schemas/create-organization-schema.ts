import { z } from 'zod'

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  city: z.string().optional(),
  active: z.boolean().default(true),
  modules: z.array(
    z.object({
      moduleKey: z.enum(['ONLINE_ORDERS', 'TOTEM', 'EVENTS', 'PAYMENTS', 'PRINTING', 'NFC_CASHLESS', 'FINANCIAL', 'DEVICES', 'REPORTS', 'DELIVERY', 'WHATSAPP', 'LOYALTY']),
      enabled: z.boolean().default(false)
    })
  ).optional()
})
