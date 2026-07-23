import { prisma } from '../../../lib/prisma.js';
export async function profileController(request, reply) {
    const userId = request.user.sub;
    const user = await prisma.user.findUnique({
        where: {
            id: userId
        },
        include: {
            organization: {
                include: {
                    organizationModules: true
                }
            }
        }
    });
    return reply.send({
        user: {
            id: user?.id,
            name: user?.name,
            email: user?.email,
            role: user?.role,
            organizationId: user?.organizationId,
            organization: user?.organization ? {
                id: user.organization.id,
                name: user.organization.name,
                slug: user.organization.slug,
                active: true,
                city: null,
                modules: user.organization.organizationModules.map(mod => ({
                    moduleKey: mod.moduleKey,
                    enabled: mod.enabled
                }))
            } : null
        }
    });
}
