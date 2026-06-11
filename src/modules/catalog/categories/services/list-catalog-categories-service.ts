import { prisma } from '../../../../lib/prisma.js'

interface ListCatalogCategoriesServiceRequest {
  organizationId: string
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