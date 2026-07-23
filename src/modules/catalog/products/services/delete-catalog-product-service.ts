import { AuditAction, UserRole } from '@prisma/client'

import { prisma } from '../../../../lib/prisma.js'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'
import { catalogOperationError } from '../../shared/tenant-guard.js'

interface DeleteCatalogProductServiceRequest {
  organizationId: string
  userId: string
  userRole: UserRole
  productId: string
}

const auditedProductFields = [
  'catalogCategoryId',
  'name',
  'slug',
  'description',
  'imageUrl',
  'active',
  'priceInCents',
  'pricingRule',
  'supportsHalfAndHalf',
  'canBeUsedAsFlavor',
  'halfAndHalfFlavorCategoryId',
  'sortOrder'
] as const

function pickProductAuditData(product: Record<string, any>) {
  return Object.fromEntries(
    auditedProductFields.map(field => [field, product[field]])
  )
}

export class DeleteCatalogProductService {
  async execute({
    organizationId,
    userId,
    productId
  }: DeleteCatalogProductServiceRequest) {
    const product = await prisma.catalogProduct.findFirst({
      where: { id: productId, organizationId },
      include: {
        _count: {
          select: {
            eventProducts: true,
            orderItems: true,
            onlineOrderItems: true,
            orderItemFlavors: true,
            onlineOrderItemFlavors: true,
            optionGroups: true,
            linkedProductOptions: true
          }
        }
      }
    })

    if (!product) {
      throw catalogOperationError({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produto nao encontrado.',
        statusCode: 404
      })
    }

    const dependencies = {
      eventProducts: product._count.eventProducts,
      orderItems: product._count.orderItems,
      onlineOrderItems: product._count.onlineOrderItems,
      orderItemFlavors: product._count.orderItemFlavors,
      onlineOrderItemFlavors: product._count.onlineOrderItemFlavors,
      optionGroups: product._count.optionGroups,
      linkedProductOptions: product._count.linkedProductOptions
    }

    const hasHistory =
      dependencies.orderItems > 0 ||
      dependencies.onlineOrderItems > 0 ||
      dependencies.orderItemFlavors > 0 ||
      dependencies.onlineOrderItemFlavors > 0

    const hasOperationalLinks = dependencies.eventProducts > 0
    const beforeData = pickProductAuditData(product as Record<string, any>)

    if (hasHistory || hasOperationalLinks) {
      const updatedProduct = product.active
        ? await prisma.catalogProduct.update({
            where: { id: product.id },
            data: { active: false }
          })
        : product

      await new CreateAuditLogService().execute({
        organizationId,
        userId,
        entity: 'CatalogProduct',
        entityId: product.id,
        action: AuditAction.PRODUCT_DEACTIVATED,
        description: 'Produto inativado em vez de excluido',
        metadata: {
          productId: product.id,
          result: 'DEACTIVATED',
          reason: hasHistory
            ? 'CATALOG_PRODUCT_HAS_HISTORY'
            : 'CATALOG_PRODUCT_HAS_EVENT_LINKS',
          dependencies,
          beforeData,
          afterData: pickProductAuditData(updatedProduct as Record<string, any>)
        }
      })

      return {
        action: 'DEACTIVATED' as const,
        code: 'CATALOG_PRODUCT_HAS_HISTORY',
        product: updatedProduct,
        message: hasHistory
          ? 'Este produto possui historico e foi inativado em vez de excluido.'
          : 'Este produto possui vinculos com evento e foi inativado em vez de excluido.',
        dependencies
      }
    }

    await prisma.$transaction(async tx => {
      await tx.catalogProductOption.updateMany({
        where: {
          organizationId,
          linkedProductId: product.id
        },
        data: {
          linkedProductId: null
        }
      })

      await tx.catalogProduct.delete({
        where: { id: product.id }
      })
    })

    await new CreateAuditLogService().execute({
      organizationId,
      userId,
      entity: 'CatalogProduct',
      entityId: product.id,
      action: AuditAction.PRODUCT_DELETED,
      description: 'Produto excluido',
      metadata: {
        productId: product.id,
        result: 'DELETED',
        dependencies,
        beforeData
      }
    })

    return {
      action: 'DELETED' as const,
      code: 'CATALOG_PRODUCT_DELETED',
      productId: product.id,
      message: 'Produto excluido.',
      dependencies
    }
  }
}
