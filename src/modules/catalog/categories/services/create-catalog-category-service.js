import { prisma } from '../../../../lib/prisma.js';
export class CreateCatalogCategoryService {
    async execute({ organizationId, name, slug, sector, sortOrder }) {
        const categoryWithSameSlug = await prisma.catalogCategory.findFirst({
            where: {
                organizationId,
                slug
            }
        });
        if (categoryWithSameSlug) {
            throw new Error('Catalog category already exists');
        }
        const category = await prisma.catalogCategory.create({
            data: {
                organizationId,
                name,
                slug,
                sector,
                sortOrder
            }
        });
        return {
            category
        };
    }
}
