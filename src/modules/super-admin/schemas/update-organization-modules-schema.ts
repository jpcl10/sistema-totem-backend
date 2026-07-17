import { z } from 'zod'

export const updateOrganizationModulesParamsSchema = z.object({
  id: z.string().min(1)
})

export const updateOrganizationModulesSchema = z.object({
  modules: z.array(
    z.object({
      moduleKey: z.enum(['ONLINE_ORDERS', 'TOTEM', 'EVENTS', 'PAYMENTS', 'NFC_CASHLESS', 'FINANCIAL', 'DEVICES', 'REPORTS', 'DELIVERY', 'WHATSAPP', 'LOYALTY', 'PRINTING']),
      enabled: z.boolean()
    })
  )
})
