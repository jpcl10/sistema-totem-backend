import { prisma } from '../../../../lib/prisma.js'

interface ListCatalogProductsServiceRequest {
  organizationId: string
}

export class ListCatalogProductsService {
  async execute({
    organizationId
  }: ListCatalogProductsServiceRequest) {
    const products =
      await prisma.catalogProduct.findMany({
        where: {
          organizationId
        },
        include: {
          catalogCategory: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

    return {
      products
    }
  }
}