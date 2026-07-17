import { prisma } from '../../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface CreateCatalogCategoryServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string

  name: string
  slug: string

  sector?: 'BAR' | 'KITCHEN'
  sortOrder?: number
}

export class CreateCatalogCategoryService {
  async execute({
    organizationId,
    name,
    slug,
    sector,
    sortOrder
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
          sector,
          sortOrder
        }
      })

    return {
      category
    }
  }
}
