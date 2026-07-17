import { z } from 'zod'

export const payOrderWithNfcBalanceSchema = z.object({
  nfcCardId: z.string().optional(),
  uid: z.string().optional()
}).refine(data => data.nfcCardId || data.uid, {
  message: 'Either nfcCardId or uid is required',
  path: ['nfcCardId', 'uid']
})
