import { z } from 'zod'

export const createPrinterSchema = z.object({
  name: z.string().min(2),

  sector: z.enum([
    'FULL_ORDER',
    'BAR',
    'KITCHEN'
  ]),

  connectionType: z.enum([
    'TCP_IP',
    'SK210_LOCAL'
  ]).default('TCP_IP'),

  ipAddress: z.string().min(3),

  port: z.number()
    .int()
    .positive()
    .default(9100),

  paperSize: z.enum([
    '58mm',
    '80mm'
  ]),

  active: z.boolean().default(true)
})