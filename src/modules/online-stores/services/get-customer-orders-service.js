import { prisma } from '../../../lib/prisma.js';
export class GetCustomerOrdersService {
    async execute(request) {
        const store = await prisma.onlineStore.findUnique({
            where: {
                slug: request.slug,
                active: true
            }
        });
        if (!store) {
            throw new Error('Store not found');
        }
        const orders = await prisma.onlineOrder.findMany({
            where: {
                storeId: store.id,
                customerId: request.customerId,
                customer: {
                    organizationId: store.organizationId
                }
            },
            include: {
                store: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        organizationId: true
                    }
                },
                items: {
                    include: {
                        options: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            orders
        };
    }
}
