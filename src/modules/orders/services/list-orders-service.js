import { prisma } from '../../../lib/prisma.js';
export class ListOrdersService {
    async execute({ organizationId, eventId }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const orders = await prisma.order.findMany({
            where: {
                eventId
            },
            include: {
                items: {
                    include: {
                        catalogProduct: {
                            include: {
                                catalogCategory: true
                            }
                        }
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
