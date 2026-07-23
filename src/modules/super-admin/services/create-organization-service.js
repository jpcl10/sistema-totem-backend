import { prisma } from '../../../lib/prisma.js';
export class CreateOrganizationService {
    async execute(data) {
        // Check if slug already exists
        const existingOrg = await prisma.organization.findUnique({
            where: {
                slug: data.slug
            }
        });
        if (existingOrg) {
            throw new Error('Slug already in use');
        }
        const organization = await prisma.organization.create({
            data: {
                name: data.name,
                slug: data.slug
            },
            include: {
                organizationModules: true,
                users: true
            }
        });
        // Create modules if provided
        if (data.modules && data.modules.length > 0) {
            await prisma.organizationModule.createMany({
                data: data.modules.map(mod => ({
                    organizationId: organization.id,
                    moduleKey: mod.moduleKey,
                    enabled: mod.enabled
                }))
            });
        }
        // Refetch to get modules
        const orgWithModules = await prisma.organization.findUnique({
            where: { id: organization.id },
            include: { organizationModules: true, users: true }
        });
        if (!orgWithModules) {
            throw new Error('Organization not found');
        }
        return {
            id: orgWithModules.id,
            name: orgWithModules.name,
            slug: orgWithModules.slug,
            city: null,
            active: true,
            createdAt: orgWithModules.createdAt,
            modules: orgWithModules.organizationModules.map(mod => ({
                moduleKey: mod.moduleKey,
                enabled: mod.enabled
            })),
            modulesCount: orgWithModules.organizationModules.length,
            usersCount: orgWithModules.users.length
        };
    }
}
