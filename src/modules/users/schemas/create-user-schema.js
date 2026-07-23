import { z } from 'zod';
export const createUserSchema = z.object({
    organizationId: z.string(),
    name: z.string(),
    email: z.email(),
    password: z.string().min(6),
    role: z.enum([
        'SUPER_ADMIN',
        'ADMIN',
        'OPERATOR'
    ])
});
