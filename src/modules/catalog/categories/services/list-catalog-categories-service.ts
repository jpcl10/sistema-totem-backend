import { prisma } from '../../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface ListCatalogCategoriesServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
}

export class ListCatalogCategoriesService {
  async execute({
    organizationId
  }: ListCatalogCategoriesServiceRequest) {
    const categories =
      await prisma.catalogCategory.findMany({
        where: {
          organizationId
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

    return {
      categories
    }
  }
}
