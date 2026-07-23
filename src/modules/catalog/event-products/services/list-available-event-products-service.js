import { prisma } from '../../../../lib/prisma.js';
import { catalogProductInclude, formatAvailableCatalogProduct } from './event-product-presenter.js';
export class ListAvailableEventProductsService {
    async execute({ organizationId, eventId, search, categoryId, active = true, page, limit }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            },
            select: {
                id: true
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const where = {
            organizationId,
            ...(active !== undefined && {
                active
            }),
            ...(categoryId && {
                catalogCategoryId: categoryId
            }),
            ...(search && {
                OR: [
                    {
                        name: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    },
                    {
                        description: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                ]
            })
        };
        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            prisma.catalogProduct.findMany({
                where,
                include: catalogProductInclude(),
                orderBy: [
                    {
                        catalogCategory: {
                            sortOrder: 'asc'
                        }
                    },
                    {
                        sortOrder: 'asc'
                    },
                    {
                        name: 'asc'
                    }
                ],
                skip,
                take: limit
            }),
            prisma.catalogProduct.count({
                where
            })
        ]);
        const linkedProducts = await prisma.eventProduct.findMany({
            where: {
                eventId,
                catalogProductId: {
                    in: products.map(product => product.id)
                }
            },
            select: {
                catalogProductId: true
            }
        });
        const linkedProductIds = new Set(linkedProducts.map(product => product.catalogProductId));
        return {
            data: products.map(product => formatAvailableCatalogProduct(product, linkedProductIds.has(product.id))),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
