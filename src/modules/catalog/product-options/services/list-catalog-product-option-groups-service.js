import { prisma } from '../../../../lib/prisma.js';
export class ListCatalogProductOptionGroupsService {
    async execute({ organizationId, productId }) {
        const product = await prisma.catalogProduct.findFirst({
            where: {
                id: productId,
                organizationId
            }
        });
        if (!product) {
            throw new Error('Product not found');
        }
        const optionGroups = await prisma.catalogProductOptionGroup.findMany({
            where: {
                productId,
                organizationId
            },
            include: {
                options: {
                    orderBy: {
                        sortOrder: 'asc'
                    }
                }
            },
            orderBy: {
                sortOrder: 'asc'
            }
        });
        return {
            optionGroups
        };
    }
}
