import { z } from 'zod'
import { PaymentMethod, PaymentStatus } from '@prisma/client'

export const createManualSaleParamsSchema = z.object({
  eventId: z.string().min(1)
})

export const createManualSaleBodySchema = z.object({
  customerName: z.string().trim().optional(),
  customerId: z.string().min(1).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paymentStatus: z.nativeEnum(PaymentStatus).default(PaymentStatus.PAID),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      notes: z.string().trim().nullable().optional(),
      selectedOptions: z.array(
        z.object({
          optionGroupId: z.string().min(1),
          optionIds: z.array(z.string().min(1)).min(1)
        })
      ).optional(),
      selectedFlavorProductIds: z.array(z.string().min(1)).optional()
    })
  ).min(1)
})
