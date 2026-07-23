import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CategorySector,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../../lib/prisma.js'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'
import { DeleteCatalogCategoryService } from './delete-catalog-category-service.js'

function category(overrides: Record<string, any> = {}) {
  return {
    id: 'category-1',
    organizationId: 'org-1',
    name: 'Categoria teste',
    slug: 'categoria-teste',
    sector: CategorySector.KITCHEN,
    active: true,
    sortOrder: 0,
    products: [],
    _count: {
      products: 0,
      halfAndHalfProducts: 0
    },
    ...overrides
  }
}

function installMocks(overrides: {
  catalogCategoryFindFirst?: (args: any) => Promise<any>
  catalogCategoryDelete?: (args: any) => Promise<any>
}) {
  const originals = {
    catalogCategoryFindFirst: prisma.catalogCategory.findFirst,
    catalogCategoryDelete: prisma.catalogCategory.delete
  }

  ;(prisma.catalogCategory.findFirst as any) =
    overrides.catalogCategoryFindFirst ?? (async () => null)
  ;(prisma.catalogCategory.delete as any) =
    overrides.catalogCategoryDelete ?? (async () => null)

  return () => {
    ;(prisma.catalogCategory.findFirst as any) =
      originals.catalogCategoryFindFirst
    ;(prisma.catalogCategory.delete as any) =
      originals.catalogCategoryDelete
  }
}

function mockAudit() {
  const originalAudit = CreateAuditLogService.prototype.execute
  const calls: any[] = []
  ;(CreateAuditLogService.prototype.execute as any) = async function (args: any) {
    calls.push(args)
    return { auditLog: { id: `audit-${calls.length}` } }
  }
  return {
    calls,
    restore: () => {
      CreateAuditLogService.prototype.execute = originalAudit
    }
  }
}

test('deletes empty catalog category', async () => {
  const audit = mockAudit()
  let deleteArgs: any
  const restore = installMocks({
    catalogCategoryFindFirst: async (args) => {
      assert.equal(args.where.organizationId, 'org-1')
      return category()
    },
    catalogCategoryDelete: async (args) => {
      deleteArgs = args
      return category()
    }
  })

  try {
    const result = await new DeleteCatalogCategoryService().execute({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: UserRole.ADMIN,
      categoryId: 'category-1'
    })

    assert.equal(result.action, 'DELETED')
    assert.equal(deleteArgs.where.id, 'category-1')
    assert.equal(audit.calls[0].action, 'CATEGORY_DELETED')
  } finally {
    restore()
    audit.restore()
  }
})

test('blocks catalog category deletion when it has products', async () => {
  const audit = mockAudit()
  const restore = installMocks({
    catalogCategoryFindFirst: async () => category({
      products: [{ id: 'product-1', name: 'Produto 1', active: true }],
      _count: {
        products: 1,
        halfAndHalfProducts: 0
      }
    })
  })

  try {
    await assert.rejects(
      () => new DeleteCatalogCategoryService().execute({
        organizationId: 'org-1',
        userId: 'user-1',
        userRole: UserRole.ADMIN,
        categoryId: 'category-1'
      }),
      (error: any) => {
        assert.equal(error.code, 'CATEGORY_NOT_EMPTY')
        assert.equal(error.statusCode, 409)
        assert.equal(error.details.productCount, 1)
        return true
      }
    )
    assert.equal(audit.calls[0].action, 'CATEGORY_DELETE_BLOCKED')
    assert.equal(audit.calls[0].metadata.result, 'BLOCKED')
  } finally {
    restore()
    audit.restore()
  }
})
