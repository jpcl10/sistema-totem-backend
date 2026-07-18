import { prisma } from '../../../../lib/prisma.js'
import {
  AuditAction,
  CatalogProductPricingRule,
  UserRole
} from '@prisma/client'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'

interface UpdateCatalogProductServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  userId: string

  productId: string

  categoryId?: string

  name?: string
  slug?: string
  description?: string
  imageUrl?: string | null

  active?: boolean

  priceInCents?: number
  pricingRule?: CatalogProductPricingRule
  supportsHalfAndHalf?: boolean
  canBeUsedAsFlavor?: boolean
  halfAndHalfFlavorCategoryId?: string | null
  sortOrder?: number
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
    active,
    priceInCents,
    pricingRule,
    supportsHalfAndHalf,
    canBeUsedAsFlavor,
    halfAndHalfFlavorCategoryId,
    sortOrder
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

    const effectivePricingRule = pricingRule ?? product.pricingRule
    const effectiveSupportsHalfAndHalf =
      supportsHalfAndHalf ??
      product.supportsHalfAndHalf ??
      effectivePricingRule === CatalogProductPricingRule.MAX_SELECTED_FLAVOR
    const effectiveHalfAndHalfFlavorCategoryId =
      effectiveSupportsHalfAndHalf ||
      effectivePricingRule === CatalogProductPricingRule.MAX_SELECTED_FLAVOR
        ? (halfAndHalfFlavorCategoryId !== undefined
            ? halfAndHalfFlavorCategoryId
            : (product.halfAndHalfFlavorCategoryId ?? product.catalogCategoryId))
        : null

    if (effectiveHalfAndHalfFlavorCategoryId) {
      const flavorCategory =
        await prisma.catalogCategory.findFirst({
          where: {
            id: effectiveHalfAndHalfFlavorCategoryId,
            organizationId
          }
        })

      if (!flavorCategory) {
        throw new Error('Flavor category not found')
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

    // Check priceInCents
    if (priceInCents !== undefined && priceInCents !== product.priceInCents) {
      changedFields.push('priceInCents')
      auditMetadata.priceInCents = priceInCents
    } else {
      auditMetadata.priceInCents = product.priceInCents
    }

    if (pricingRule !== undefined && pricingRule !== product.pricingRule) {
      changedFields.push('pricingRule')
      auditMetadata.pricingRule = pricingRule
    } else {
      auditMetadata.pricingRule = product.pricingRule
    }

    if (
      supportsHalfAndHalf !== undefined &&
      supportsHalfAndHalf !== product.supportsHalfAndHalf
    ) {
      changedFields.push('supportsHalfAndHalf')
      auditMetadata.supportsHalfAndHalf = supportsHalfAndHalf
    } else {
      auditMetadata.supportsHalfAndHalf = product.supportsHalfAndHalf
    }

    if (
      canBeUsedAsFlavor !== undefined &&
      canBeUsedAsFlavor !== product.canBeUsedAsFlavor
    ) {
      changedFields.push('canBeUsedAsFlavor')
      auditMetadata.canBeUsedAsFlavor = canBeUsedAsFlavor
    } else {
      auditMetadata.canBeUsedAsFlavor = product.canBeUsedAsFlavor
    }

    if (
      effectiveHalfAndHalfFlavorCategoryId !== product.halfAndHalfFlavorCategoryId
    ) {
      changedFields.push('halfAndHalfFlavorCategoryId')
      auditMetadata.halfAndHalfFlavorCategoryId =
        effectiveHalfAndHalfFlavorCategoryId
    } else {
      auditMetadata.halfAndHalfFlavorCategoryId =
        product.halfAndHalfFlavorCategoryId
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
          }),

          ...(priceInCents !== undefined && {
            priceInCents
          }),

          ...(pricingRule !== undefined && {
            pricingRule
          }),

          ...(supportsHalfAndHalf !== undefined && {
            supportsHalfAndHalf
          }),

          ...(canBeUsedAsFlavor !== undefined && {
            canBeUsedAsFlavor
          }),

          ...(halfAndHalfFlavorCategoryId !== undefined ||
          pricingRule !== undefined ||
          supportsHalfAndHalf !== undefined
            ? {
                halfAndHalfFlavorCategoryId:
                  effectiveHalfAndHalfFlavorCategoryId
              }
            : {}),

          ...(sortOrder !== undefined && {
            sortOrder
          })
        }
      })

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
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
