import { prisma } from '../../../lib/prisma.js';
export class ListOnlineOrdersService {
    async execute({ storeId, organizationId }) {
        const store = await prisma.onlineStore.findFirst({
            where: {
                id: storeId,
                organizationId
            }
        });
        if (!store) {
            throw new Error('Store not found');
        }
        const orders = await prisma.onlineOrder.findMany({
            where: { storeId },
            include: {
                store: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        organizationId: true,
                        printingEnabled: true
                    }
                },
                items: {
                    include: {
                        options: true
                    }
                },
                printJobs: {
                    select: {
                        id: true,
                        status: true
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
