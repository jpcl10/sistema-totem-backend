import { z } from 'zod'

export const createOrderSchema = z.object({
  customerName: z.string().optional(),

  paymentStatus: z.enum([
    'NOT_REQUIRED',
    'PENDING',
    'PAID',
    'FAILED'
  ]).optional(),

  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive()
    })
  ).min(1)
})