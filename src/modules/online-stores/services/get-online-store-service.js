import { prisma } from '../../../lib/prisma.js';
export class GetOnlineStoreService {
    async execute({ id, organizationId }) {
        const store = await prisma.onlineStore.findFirst({
            where: {
                id,
                organizationId
            }
        });
        if (!store) {
            throw new Error('Store not found');
        }
        // Get catalog categories and products
        const [categories, products] = await Promise.all([
            prisma.catalogCategory.findMany({
                where: {
                    organizationId: store.organizationId,
                    active: true
                },
                orderBy: { name: 'asc' }
            }),
            prisma.catalogProduct.findMany({
                where: {
                    organizationId: store.organizationId,
                    active: true
                },
                orderBy: { name: 'asc' }
            })
        ]);
        return {
            store: {
                ...store,
                categories,
                products
            }
        };
    }
}
