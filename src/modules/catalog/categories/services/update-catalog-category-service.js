import { prisma } from '../../../../lib/prisma.js';
export class UpdateCatalogCategoryService {
    async execute({ organizationId, categoryId, name, slug, sector, active, sortOrder }) {
        const category = await prisma.catalogCategory.findFirst({
            where: {
                id: categoryId,
                organizationId
            }
        });
        if (!category) {
            throw new Error('Category not found');
        }
        const updatedCategory = await prisma.catalogCategory.update({
            where: {
                id: categoryId
            },
            data: {
                ...(name !== undefined && {
                    name
                }),
                ...(slug !== undefined && {
                    slug
                }),
                ...(sector !== undefined && {
                    sector
                }),
                ...(active !== undefined && {
                    active
                }),
                ...(sortOrder !== undefined && {
                    sortOrder
                })
            }
        });
        return {
            category: updatedCategory
        };
    }
}
