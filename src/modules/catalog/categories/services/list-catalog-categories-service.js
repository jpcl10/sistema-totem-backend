import { prisma } from '../../../../lib/prisma.js';
export class ListCatalogCategoriesService {
    async execute({ organizationId }) {
        const categories = await prisma.catalogCategory.findMany({
            where: {
                organizationId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            categories
        };
    }
}
