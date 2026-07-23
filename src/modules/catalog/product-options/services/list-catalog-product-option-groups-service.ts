import { prisma } from '../../../../lib/prisma.js'
import { UserRole } from '@prisma/client'
import { tenantDataLeakError } from '../../shared/tenant-guard.js'

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

    const leakedGroup = optionGroups.find(
      group =>
        group.organizationId !== organizationId ||
        group.options.some(option => option.organizationId !== organizationId)
    )

    if (leakedGroup) {
      throw tenantDataLeakError(
        `CatalogProductOptionGroup ${leakedGroup.id} has tenant mismatch for ${organizationId}`
      )
    }

    return {
      optionGroups
    }
  }
}
