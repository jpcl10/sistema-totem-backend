import { z } from 'zod'

export const createOnlineOrderParamsSchema = z.object({
  slug: z.string().min(1)
})

const createOnlineOrderSelectedOptionSchema = z.object({
  optionGroupId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1)
})

export const createOnlineOrderItemSchema = z.object({
  productId: z.string().min(1).optional(),
  catalogProductId: z.string().min(1).optional(),
  quantity: z.number().int().min(1),
  notes: z.string().nullable().optional(),
  selectedOptions: z.array(createOnlineOrderSelectedOptionSchema)
    .optional()
})
  .superRefine((item, ctx) => {
    if (!item.productId && !item.catalogProductId) {
      ctx.addIssue({
        code: 'custom',
        message: 'productId ou catalogProductId é obrigatório',
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
    notes: item.notes ?? undefined,
    selectedOptions: item.selectedOptions ?? []
  }))

export const createOnlineOrderSchema = z.object({
  customerId: z.string().min(1).nullable().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().trim().optional().nullable(),
  customerEmail: z.string().trim().email().optional().nullable(),
  customerDocument: z.string().trim().optional().nullable(),
  customerNotes: z.string().trim().optional().nullable(),
  fulfillment: z.enum(['DELIVERY', 'PICKUP']).default('DELIVERY'),
  customerAddressId: z.string().min(1).nullable().optional(),
  deliveryLabel: z.string().trim().optional().nullable(),
  deliveryAddress: z.string().min(1).optional(),
  deliveryNumber: z.string().min(1).optional(),
  deliveryNeighborhood: z.string().min(1).optional(),
  deliveryCity: z.string().trim().optional().nullable(),
  deliveryState: z.string().trim().optional().nullable(),
  deliveryPostalCode: z.string().trim().optional().nullable(),
  deliveryComplement: z.string().nullable().optional(),
  deliveryReference: z.string().nullable().optional(),
  paymentMethod: z.enum(['PIX', 'CARD_ON_DELIVERY', 'CASH']),
  changeForInCents: z.number().int().min(0).nullable().optional(),
  deliveryFeeInCents: z.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
  items: z.array(createOnlineOrderItemSchema).min(1)
})
  .superRefine((data, ctx) => {
    if (data.fulfillment === 'DELIVERY' && !data.customerAddressId) {
      for (const field of [
        'deliveryAddress',
        'deliveryNumber',
        'deliveryNeighborhood'
      ] as const) {
        if (!data[field]) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is required for DELIVERY`
          })
        }
      }
    }
  })
  .refine((data) => {
    if (data.paymentMethod === 'CASH') {
      return true
    }
    return data.changeForInCents === undefined || data.changeForInCents === null
  }, {
    message: 'changeForInCents is only allowed when paymentMethod is CASH',
    path: ['changeForInCents']
  })
  .transform(data => ({
    ...data,
    deliveryAddress: data.deliveryAddress ?? '',
    deliveryNumber: data.deliveryNumber ?? '',
    deliveryNeighborhood: data.deliveryNeighborhood ?? '',
    customerPhone: data.customerPhone ?? undefined,
    customerEmail: data.customerEmail ?? undefined,
    customerDocument: data.customerDocument ?? undefined,
    customerNotes: data.customerNotes ?? undefined,
    customerId: data.customerId ?? undefined,
    customerAddressId: data.customerAddressId ?? undefined,
    deliveryLabel: data.deliveryLabel ?? undefined,
    deliveryCity: data.deliveryCity ?? undefined,
    deliveryState: data.deliveryState ?? undefined,
    deliveryPostalCode: data.deliveryPostalCode ?? undefined,
    deliveryComplement: data.deliveryComplement ?? undefined,
    deliveryReference: data.deliveryReference ?? undefined,
    changeForInCents: data.changeForInCents ?? undefined,
    notes: data.notes ?? undefined
  }))
