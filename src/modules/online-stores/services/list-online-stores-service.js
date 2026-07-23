import { prisma } from '../../../lib/prisma.js';
export class ListOnlineStoresService {
    async execute({ organizationId }) {
        const stores = await prisma.onlineStore.findMany({
            where: {
                organizationId
            },
            include: {
                organization: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            stores
        };
    }
}
