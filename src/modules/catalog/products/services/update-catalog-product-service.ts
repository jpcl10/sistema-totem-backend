import { prisma } from '../../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface UpdateCatalogProductServiceRequest {
  organizationId: string
  userId: string

  productId: string

  categoryId?: string

  name?: string
  slug?: string
  description?: string
  imageUrl?: string | null

  active?: boolean
}

export class UpdateCatalogProductService {
  async execute({
    organizationId,
    userId,
    productId,
    categoryId,
    name,
    slug,
    description,
    imageUrl,
    active
  }: UpdateCatalogProductServiceRequest) {

    const product =
      await prisma.catalogProduct.findFirst({
        where: {
          id: productId,
          organizationId
        }
      })

    if (!product) {
      throw new Error('Product not found')
    }

    if (categoryId) {
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
    }

    // Determine which fields were changed
    const changedFields: string[] = []
    const auditMetadata: Record<string, any> = {}

    // Check name
    if (name !== undefined && name !== product.name) {
      changedFields.push('name')
      auditMetadata.name = name
    } else {
      auditMetadata.name = product.name
    }

    // Check slug
    if (slug !== undefined && slug !== product.slug) {
      changedFields.push('slug')
      auditMetadata.slug = slug
    } else {
      auditMetadata.slug = product.slug
    }

    // Check active
    if (active !== undefined && active !== product.active) {
      changedFields.push('active')
      auditMetadata.active = active
    } else {
      auditMetadata.active = product.active
    }

    // Check imageUrl
    if (imageUrl !== undefined && imageUrl !== product.imageUrl) {
      changedFields.push('imageUrl')
      auditMetadata.imageUrl = imageUrl
    } else {
      auditMetadata.imageUrl = product.imageUrl
    }

    // Add changed fields to metadata
    if (changedFields.length > 0) {
      auditMetadata.changedFields = changedFields
    }

    const updatedProduct =
      await prisma.catalogProduct.update({
        where: {
          id: productId
        },
        data: {
          ...(categoryId !== undefined && {
            catalogCategoryId: categoryId
          }),

          ...(name !== undefined && {
            name
          }),

          ...(slug !== undefined && {
            slug
          }),

          ...(description !== undefined && {
            description
          }),

          ...(imageUrl !== undefined && {
            imageUrl
          }),

          ...(active !== undefined && {
            active
          })
        }
      })

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: organizationId,
      userId,
      entity: 'CatalogProduct',
      entityId: updatedProduct.id,
      action: AuditAction.PRODUCT_UPDATED,
      description: 'Produto atualizado',
      metadata: auditMetadata
    })

    return {
      product: updatedProduct
    }
  }
}