import { AuditAction, UserRole } from '@prisma/client'

import { prisma } from '../../../../lib/prisma.js'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'
import { catalogOperationError } from '../../shared/tenant-guard.js'

interface DeleteCatalogCategoryServiceRequest {
  organizationId: string
  userId: string
  userRole: UserRole
  categoryId: string
}

export class DeleteCatalogCategoryService {
  async execute({
    organizationId,
    userId,
    categoryId
  }: DeleteCatalogCategoryServiceRequest) {
    const category = await prisma.catalogCategory.findFirst({
      where: { id: categoryId, organizationId },
      include: {
        _count: {
          select: {
            products: true,
            halfAndHalfProducts: true
          }
        },
        products: {
          select: { id: true, name: true, active: true },
          orderBy: { name: 'asc' },
          take: 8
        }
      }
    })

    if (!category) {
      throw catalogOperationError({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Categoria nao encontrada.',
        statusCode: 404
      })
    }

    const productCount = category._count.products
    const halfAndHalfDependencyCount = category._count.halfAndHalfProducts

    if (productCount > 0 || halfAndHalfDependencyCount > 0) {
      await new CreateAuditLogService().execute({
        organizationId,
        userId,
        entity: 'CatalogCategory',
        entityId: category.id,
        action: AuditAction.CATEGORY_DELETE_BLOCKED,
        description: 'Exclusao de categoria bloqueada',
        metadata: {
          categoryId: category.id,
          result: 'BLOCKED',
          reason:
            productCount > 0
              ? 'CATEGORY_NOT_EMPTY'
              : 'CATEGORY_USED_AS_HALF_AND_HALF_FLAVOR_CATEGORY',
          dependencies: {
            productCount,
            halfAndHalfDependencyCount,
            products: category.products
          }
        }
      })

      throw catalogOperationError({
        code: productCount > 0
          ? 'CATEGORY_NOT_EMPTY'
          : 'CATEGORY_HAS_DEPENDENCIES',
        message: productCount > 0
          ? `Esta categoria possui ${productCount} produto${productCount === 1 ? '' : 's'}. Mova, inative ou exclua os produtos antes.`
          : 'Esta categoria e usada como categoria de sabores em produtos meio a meio.',
        statusCode: 409,
        details: {
          action: 'BLOCKED',
          productCount,
          halfAndHalfDependencyCount,
          products: category.products
        }
      })
    }

    await prisma.catalogCategory.delete({
      where: { id: category.id }
    })

    await new CreateAuditLogService().execute({
      organizationId,
      userId,
      entity: 'CatalogCategory',
      entityId: category.id,
      action: AuditAction.CATEGORY_DELETED,
      description: 'Categoria excluida',
      metadata: {
        categoryId: category.id,
        result: 'DELETED',
        beforeData: {
          name: category.name,
          slug: category.slug,
          sector: category.sector,
          active: category.active,
          sortOrder: category.sortOrder
        }
      }
    })

    return {
      action: 'DELETED' as const,
      categoryId: category.id,
      message: 'Categoria excluida.'
    }
  }
}
