import { z } from 'zod'

export const updateSuperAdminUserSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(6).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR']),
  confirmOrganizationChange: z.boolean().optional()
})
