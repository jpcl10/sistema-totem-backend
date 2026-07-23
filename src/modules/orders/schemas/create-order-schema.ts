import { z } from 'zod'

const selectedOptionSchema = z.object({
  optionGroupId: z.string().cuid(),
  optionIds: z.array(
    z.string().cuid()
  ).min(1)
}).superRefine((selectedOption, ctx) => {
  const uniqueOptionIds =
    new Set(selectedOption.optionIds)

  if (uniqueOptionIds.size !== selectedOption.optionIds.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['optionIds'],
      message: 'Duplicate optionIds are not allowed'
    })
  }
})

const orderItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive(),
  selectedOptions: z.array(
    selectedOptionSchema
  ).optional(),
  selectedFlavorProductIds: z.array(z.string().cuid()).optional()
}).superRefine((item, ctx) => {
  if (!item.selectedOptions) {
    return
  }

  const optionGroupIds =
    item.selectedOptions.map(option => option.optionGroupId)

  const uniqueOptionGroupIds =
    new Set(optionGroupIds)

  if (uniqueOptionGroupIds.size !== optionGroupIds.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['selectedOptions'],
      message: 'Duplicate optionGroupId is not allowed'
    })
  }
})

export const createOrderSchema = z.object({
  customerName: z.string().optional(),
  customerId: z.string().cuid().optional(),
  checkoutContext: z.enum(['TOTEM', 'PUBLIC_EVENT']).optional(),
  paymentMethod: z.enum([
    'PIX',
    'CARD',
    'PIX_AUTOMATIC',
    'CREDIT_CARD',
    'DEBIT_CARD'
  ]).optional(),

  paymentStatus: z.enum([
    'NOT_REQUIRED',
    'PENDING',
    'PAID',
    'FAILED'
  ]).optional(),

  items: z.array(
    orderItemSchema
  ).min(1)
}).superRefine((order, ctx) => {
  if (order.checkoutContext !== 'TOTEM') {
    return
  }

  const method = order.paymentMethod
  if (method && !['PIX', 'CARD'].includes(method)) {
    ctx.addIssue({
      code: 'custom',
      path: ['paymentMethod'],
      message: 'Totem orders only allow PIX or CARD payment methods'
    })
  }

  if (order.paymentStatus === 'PAID' || order.paymentStatus === 'NOT_REQUIRED') {
    ctx.addIssue({
      code: 'custom',
      path: ['paymentStatus'],
      message: 'Totem orders cannot be created as paid'
    })
  }
})
