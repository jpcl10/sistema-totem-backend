import { prisma } from '../../../../lib/prisma.js'
import { UserRole } from '@prisma/client'
import { tenantDataLeakError } from '../../shared/tenant-guard.js'

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
        include: {
          _count: {
            select: {
              products: {
                where: {
                  organizationId
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

    const leakedCategory = categories.find(
      category => category.organizationId !== organizationId
    )

    if (leakedCategory) {
      throw tenantDataLeakError(
        `CatalogCategory ${leakedCategory.id} does not belong to tenant ${organizationId}`
      )
    }

    return {
      categories
    }
  }
}
