import { prisma } from '../../../lib/prisma.js';
export class GetOrganizationService {
    async execute(id) {
        const org = await prisma.organization.findUnique({
            where: { id },
            include: { organizationModules: true, users: true }
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        return {
            organization: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                city: null,
                active: true,
                createdAt: org.createdAt,
                modules: org.organizationModules.map(mod => ({
                    moduleKey: mod.moduleKey,
                    enabled: mod.enabled
                })),
                usersCount: org.users.length
            }
        };
    }
}
