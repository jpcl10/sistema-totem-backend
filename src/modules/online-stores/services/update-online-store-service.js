import { prisma } from '../../../lib/prisma.js';
export class UpdateOnlineStoreService {
    async execute(request) {
        const store = await prisma.onlineStore.findFirst({
            where: {
                id: request.id,
                organizationId: request.organizationId
            }
        });
        if (!store) {
            throw new Error('Store not found');
        }
        // Check slug uniqueness if changing
        if (request.slug && request.slug !== store.slug) {
            const existingStore = await prisma.onlineStore.findUnique({
                where: { slug: request.slug }
            });
            if (existingStore) {
                throw new Error('Slug is already in use');
            }
        }
        const updatedStore = await prisma.onlineStore.update({
            where: { id: request.id },
            data: {
                name: request.name,
                slug: request.slug,
                whatsapp: request.whatsapp,
                city: request.city,
                address: request.address,
                logoUrl: request.logoUrl,
                bannerUrl: request.bannerUrl,
                isOpen: request.isOpen,
                active: request.active
            }
        });
        return {
            store: updatedStore
        };
    }
}
