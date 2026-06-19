import { z } from 'zod'

export const readNfcCardSchema = z.object({
  uid: z.string().min(1)
})
