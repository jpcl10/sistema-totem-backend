import { prisma } from '../../../../lib/prisma.js'
import { UserRole } from '@prisma/client'
import { tenantDataLeakError } from '../../shared/tenant-guard.js'

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
          organizationId,
          catalogCategory: {
            organizationId
          }
        },
        include: {
          catalogCategory: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

    const leakedProduct = products.find(
      product =>
        product.organizationId !== organizationId ||
        product.catalogCategory.organizationId !== organizationId
    )

    if (leakedProduct) {
      throw tenantDataLeakError(
        `CatalogProduct ${leakedProduct.id} has tenant mismatch for ${organizationId}`
      )
    }

    return {
      products
    }
  }
}
