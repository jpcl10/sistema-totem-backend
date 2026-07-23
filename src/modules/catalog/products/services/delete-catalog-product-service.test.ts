import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CatalogProductPricingRule,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../../lib/prisma.js'
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js'
import { DeleteCatalogProductService } from './delete-catalog-product-service.js'

function product(overrides: Record<string, any> = {}) {
  return {
    id: 'product-1',
    organizationId: 'org-1',
    catalogCategoryId: 'category-1',
    name: 'Produto teste',
    slug: 'produto-teste',
    description: null,
    imageUrl: null,
    priceInCents: 1000,
    pricingRule: CatalogProductPricingRule.STANDARD,
    supportsHalfAndHalf: false,
    canBeUsedAsFlavor: true,
    halfAndHalfFlavorCategoryId: null,
    active: true,
    sortOrder: 0,
    _count: {
      eventProducts: 0,
      orderItems: 0,
      onlineOrderItems: 0,
      orderItemFlavors: 0,
      onlineOrderItemFlavors: 0,
      optionGroups: 0,
      linkedProductOptions: 0
    },
    ...overrides
  }
}

function installMocks(overrides: {
  catalogProductFindFirst?: (args: any) => Promise<any>
  catalogProductUpdate?: (args: any) => Promise<any>
  transaction?: (callback: any) => Promise<any>
}) {
  const originals = {
    catalogProductFindFirst: prisma.catalogProduct.findFirst,
    catalogProductUpdate: prisma.catalogProduct.update,
    transaction: prisma.$transaction
  }

  ;(prisma.catalogProduct.findFirst as any) =
    overrides.catalogProductFindFirst ?? (async () => null)
  ;(prisma.catalogProduct.update as any) =
    overrides.catalogProductUpdate ?? (async () => null)
  ;(prisma.$transaction as any) =
    overrides.transaction ?? (async (callback: any) => callback(prisma))

  return () => {
    ;(prisma.catalogProduct.findFirst as any) = originals.catalogProductFindFirst
    ;(prisma.catalogProduct.update as any) = originals.catalogProductUpdate
    ;(prisma.$transaction as any) = originals.transaction
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

test('deletes catalog product without history inside a transaction', async () => {
  const audit = mockAudit()
  const operations: string[] = []
  const tx = {
    catalogProductOption: {
      updateMany: async (args: any) => {
        operations.push(`unlink:${args.where.linkedProductId}`)
        return { count: 0 }
      }
    },
    catalogProduct: {
      delete: async (args: any) => {
        operations.push(`delete:${args.where.id}`)
        return product()
      }
    }
  }

  const restore = installMocks({
    catalogProductFindFirst: async (args) => {
      assert.equal(args.where.organizationId, 'org-1')
      return product()
    },
    transaction: async (callback) => callback(tx)
  })

  try {
    const result = await new DeleteCatalogProductService().execute({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: UserRole.ADMIN,
      productId: 'product-1'
    })

    assert.equal(result.action, 'DELETED')
    assert.deepEqual(operations, ['unlink:product-1', 'delete:product-1'])
    assert.equal(audit.calls[0].action, 'PRODUCT_DELETED')
  } finally {
    restore()
    audit.restore()
  }
})

test('deactivates catalog product with order history instead of deleting', async () => {
  const audit = mockAudit()
  let updateArgs: any
  const restore = installMocks({
    catalogProductFindFirst: async () => product({
      _count: {
        eventProducts: 0,
        orderItems: 1,
        onlineOrderItems: 0,
        orderItemFlavors: 0,
        onlineOrderItemFlavors: 0,
        optionGroups: 0,
        linkedProductOptions: 0
      }
    }),
    catalogProductUpdate: async (args) => {
      updateArgs = args
      return product({ active: false })
    }
  })

  try {
    const result = await new DeleteCatalogProductService().execute({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: UserRole.ADMIN,
      productId: 'product-1'
    })

    assert.equal(result.action, 'DEACTIVATED')
    assert.equal(updateArgs.data.active, false)
    assert.equal(audit.calls[0].action, 'PRODUCT_DEACTIVATED')
    assert.equal(audit.calls[0].metadata.result, 'DEACTIVATED')
  } finally {
    restore()
    audit.restore()
  }
})

test('returns 404 for catalog product outside tenant', async () => {
  const restore = installMocks({
    catalogProductFindFirst: async (args) => {
      assert.equal(args.where.organizationId, 'org-1')
      return null
    }
  })

  try {
    await assert.rejects(
      () => new DeleteCatalogProductService().execute({
        organizationId: 'org-1',
        userId: 'user-1',
        userRole: UserRole.ADMIN,
        productId: 'foreign-product'
      }),
      (error: any) => {
        assert.equal(error.code, 'PRODUCT_NOT_FOUND')
        assert.equal(error.statusCode, 404)
        return true
      }
    )
  } finally {
    restore()
  }
})
