import { prisma } from '../../../../lib/prisma.js';
export class ListCatalogProductsService {
    async execute({ organizationId }) {
        const products = await prisma.catalogProduct.findMany({
            where: {
                organizationId
            },
            include: {
                catalogCategory: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            products
        };
    }
}
