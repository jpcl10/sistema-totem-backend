import { z } from 'zod';
export const createSuperAdminUserSchema = z.object({
    organizationId: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR'])
});
