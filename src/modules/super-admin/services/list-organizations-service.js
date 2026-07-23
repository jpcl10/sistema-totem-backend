import { prisma } from '../../../lib/prisma.js';
export class ListOrganizationsService {
    async execute() {
        const organizations = await prisma.organization.findMany({
            include: {
                organizationModules: true,
                users: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return organizations.map(org => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            city: null, // Note: Organization schema doesn't have city field yet!
            active: true, // Default true since we don't have active field in schema
            createdAt: org.createdAt,
            modules: org.organizationModules.map(mod => ({
                moduleKey: mod.moduleKey,
                enabled: mod.enabled
            })),
            modulesCount: org.organizationModules.filter(mod => mod.enabled).length,
            usersCount: org.users.length
        }));
    }
}
