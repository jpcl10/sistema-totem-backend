import { z } from 'zod'
import { PaymentStatus } from '@prisma/client'

export const createManualOnlineOrderParamsSchema = z.object({
  storeId: z.string().min(1)
})

const selectedOptionSchema = z.object({
  optionGroupId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1)
})

const manualOnlineOrderItemSchema = z.object({
  productId: z.string().min(1).optional(),
  catalogProductId: z.string().min(1).optional(),
  quantity: z.number().int().positive(),
  notes: z.string().trim().nullable().optional(),
  selectedOptions: z.array(selectedOptionSchema).optional()
})
  .superRefine((item, ctx) => {
    if (!item.productId && !item.catalogProductId) {
      ctx.addIssue({
        code: 'custom',
        message: 'productId ou catalogProductId e obrigatorio',
        path: ['productId']
      })
    }

    if (
      item.productId &&
      item.catalogProductId &&
      item.productId !== item.catalogProductId
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'productId e catalogProductId devem ser iguais quando enviados juntos',
        path: ['catalogProductId']
      })
    }
  })
  .transform(item => ({
    catalogProductId: item.catalogProductId ?? item.productId!,
    quantity: item.quantity,
    notes: item.notes ?? null,
    selectedOptions: item.selectedOptions ?? []
  }))

export const createManualOnlineOrderSchema = z.object({
  customerId: z.string().min(1).nullable().optional(),
  customer: z.object({
    name: z.string().trim().min(1).optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    email: z.string().trim().email().optional().nullable(),
    document: z.string().trim().optional().nullable(),
    notes: z.string().trim().optional().nullable()
  }).optional().nullable(),
  customerAddressId: z.string().min(1).nullable().optional(),
  fulfillment: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  delivery: z.object({
    label: z.string().trim().optional().nullable(),
    address: z.string().trim().min(1),
    number: z.string().trim().min(1),
    neighborhood: z.string().trim().min(1),
    city: z.string().trim().optional().nullable(),
    state: z.string().trim().optional().nullable(),
    postalCode: z.string().trim().optional().nullable(),
    complement: z.string().trim().optional().nullable(),
    reference: z.string().trim().optional().nullable()
  }).optional().nullable(),
  paymentMethod: z.enum(['PIX', 'CARD_ON_DELIVERY', 'CASH']),
  paymentStatus: z.nativeEnum(PaymentStatus).default(PaymentStatus.PAID),
  amountReceivedInCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  items: z.array(manualOnlineOrderItemSchema).min(1)
})
  .superRefine((data, ctx) => {
    if (
      data.fulfillment === 'DELIVERY' &&
      !data.customerAddressId &&
      !data.delivery
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'delivery e obrigatorio quando fulfillment e DELIVERY sem customerAddressId',
        path: ['delivery']
      })
    }

    if (
      data.paymentMethod !== 'CASH' &&
      data.amountReceivedInCents !== undefined &&
      data.amountReceivedInCents !== null
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'amountReceivedInCents is only allowed when paymentMethod is CASH',
        path: ['amountReceivedInCents']
      })
    }
  })
  .transform(data => ({
    ...data,
    customerId: data.customerId ?? null,
    customer: data.customer ?? null,
    customerAddressId: data.customerAddressId ?? null,
    delivery: data.delivery ?? null,
    amountReceivedInCents: data.amountReceivedInCents ?? null,
    notes: data.notes ?? null
  }))
