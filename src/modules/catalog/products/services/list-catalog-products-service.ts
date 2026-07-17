import { prisma } from '../../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface ListCatalogProductsServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
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
