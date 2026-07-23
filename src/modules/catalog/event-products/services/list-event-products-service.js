import { prisma } from '../../../../lib/prisma.js';
import { catalogProductInclude, formatEventProduct } from './event-product-presenter.js';
export class ListEventProductsService {
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
        const eventProducts = await prisma.eventProduct.findMany({
            where: {
                eventId,
                event: {
                    organizationId
                }
            },
            include: {
                catalogProduct: {
                    include: catalogProductInclude()
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            eventProducts: eventProducts.map(formatEventProduct)
        };
    }
}
