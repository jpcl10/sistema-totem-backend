import { z } from 'zod'

export const closeEventBodySchema = z.object({
  notes: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional(),

  allowPendingOrders: z
    .boolean()
    .default(false),

  allowPrintErrors: z
    .boolean()
    .default(false)
})

export type CloseEventBody =
  z.infer<typeof closeEventBodySchema>