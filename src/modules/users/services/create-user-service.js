import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction } from '@prisma/client';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
export class CreateUserService {
    async execute(data) {
        const userAlreadyExists = await prisma.user.findUnique({
            where: {
                email: data.email
            }
        });
        if (userAlreadyExists) {
            throw new Error('User already exists.');
        }
        const passwordHash = await bcrypt.hash(data.password, 6);
        const user = await prisma.user.create({
            data: {
                organizationId: data.organizationId,
                name: data.name,
                email: data.email,
                password: passwordHash,
                role: data.role
            }
        });
        // Create audit log for user creation
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId: user.organizationId,
            entity: 'User',
            entityId: user.id,
            action: AuditAction.USER_CREATED,
            description: 'Usuário criado',
            metadata: {
                userId: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
        return user;
    }
}
