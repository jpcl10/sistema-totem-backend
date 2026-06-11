import { prisma } from '../../../../lib/prisma.js'

interface CreateCatalogCategoryServiceRequest {
  organizationId: string

  name: string
  slug: string

  sector?: 'BAR' | 'KITCHEN'
}

export class CreateCatalogCategoryService {
  async execute({
    organizationId,
    name,
    slug,
    sector
  }: CreateCatalogCategoryServiceRequest) {

    const categoryWithSameSlug =
      await prisma.catalogCategory.findFirst({
        where: {
          organizationId,
          slug
        }
      })

    if (categoryWithSameSlug) {
      throw new Error('Catalog category already exists')
    }

    const category =
      await prisma.catalogCategory.create({
        data: {
          organizationId,
          name,
          slug,
          sector
        }
      })

    return {
      category
    }
  }
}