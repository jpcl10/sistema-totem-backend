import { prisma } from '../../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface ListCatalogProductOptionGroupsServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  productId: string
}

export class ListCatalogProductOptionGroupsService {
  async execute({
    organizationId,
    productId
  }: ListCatalogProductOptionGroupsServiceRequest) {
    const product = await prisma.catalogProduct.findFirst({
      where: {
        id: productId,
        organizationId
      }
    })

    if (!product) {
      throw new Error('Product not found')
    }

    const optionGroups = await prisma.catalogProductOptionGroup.findMany({
      where: {
        productId,
        organizationId
      },
      include: {
        options: {
          orderBy: {
            sortOrder: 'asc'
          }
        }
      },
      orderBy: {
        sortOrder: 'asc'
      }
    })

    return {
      optionGroups
    }
  }
}
