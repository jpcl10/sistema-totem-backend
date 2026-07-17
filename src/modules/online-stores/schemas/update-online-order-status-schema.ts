import { z } from 'zod'

export const updateOnlineOrderStatusParamsSchema = z.object({
  orderId: z.string().min(1)
})

export const updateOnlineOrderStatusSchema = z.object({
  status: z.enum([
    'RECEIVED',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED'
  ])
})
