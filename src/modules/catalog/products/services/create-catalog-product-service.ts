import { prisma } from '../../../../lib/prisma.js'
import { AuditAction, UserRole } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface CreateCatalogProductServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string

  categoryId: string

  name: string
  slug: string

  description?: string
  imageUrl?: string

  priceInCents: number
  sortOrder?: number
}

export class CreateCatalogProductService {
  async execute({
    organizationId,
    userId,
    categoryId,
    name,
    slug,
    description,
    imageUrl,
    priceInCents,
    sortOrder
  }: CreateCatalogProductServiceRequest) {
    const category =
      await prisma.catalogCategory.findFirst({
        where: {
          id: categoryId,
          organizationId
        }
      })

    if (!category) {
      throw new Error('Category not found')
    }

    const productWithSameSlug =
      await prisma.catalogProduct.findFirst({
        where: {
          organizationId,
          slug
        }
      })

    if (productWithSameSlug) {
      throw new Error('Product already exists')
    }

    const product =
      await prisma.catalogProduct.create({
        data: {
                organizationId,
                catalogCategoryId: categoryId,
                name,
                slug,
                description,
                imageUrl,
                priceInCents,
                sortOrder
            }
      })

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      userId,
      entity: 'CatalogProduct',
      entityId: product.id,
      action: AuditAction.PRODUCT_CREATED,
      description: 'Produto criado',
      metadata: {
        name: product.name,
        slug: product.slug,
        categoryId: product.catalogCategoryId,
        imageUrl: product.imageUrl,
        priceInCents: product.priceInCents
      }
    })

    return {
      product
    }
  }
}
