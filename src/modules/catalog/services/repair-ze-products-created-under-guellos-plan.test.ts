import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCatalogRepairPlan,
  type CatalogRepairPlan
} from '../../../../scripts/repair-ze-products-created-under-guellos.js'

const classification = {
  group: 'B_ZE_UNDER_GUELLOS' as const,
  evidence: ['test'],
  warnings: []
}

function category(overrides: Partial<Parameters<typeof buildCatalogRepairPlan>[0]['categoriesCandidateToMove'][number]> = {}) {
  return {
    id: 'source-category',
    name: 'BEBIDAS',
    slug: 'bebidas',
    sector: 'BAR' as const,
    active: true,
    sortOrder: 1,
    classification,
    ...overrides
  }
}

function product(overrides: Partial<Parameters<typeof buildCatalogRepairPlan>[0]['productsCandidateToMove'][number]> = {}) {
  return {
    id: 'source-product',
    name: 'GELO',
    slug: 'gelo',
    categoryId: 'source-category',
    ...overrides
  }
}

function plan(overrides: Partial<Parameters<typeof buildCatalogRepairPlan>[0]> = {}): CatalogRepairPlan {
  return buildCatalogRepairPlan({
    categoriesCandidateToMove: [category()],
    productsCandidateToMove: [product()],
    existingTargetCategories: [],
    existingTargetProducts: [],
    sourceCategoryRelations: [{
      sourceCategoryId: 'source-category',
      productCount: 1,
      candidateProductCount: 1,
      halfAndHalfProductCount: 0
    }],
    ...overrides
  })
}

test('moves category when slug does not exist in target organization', () => {
  const result = plan()

  assert.equal(result.categoryMoves.length, 1)
  assert.equal(result.categoryMoves[0].sourceCategoryId, 'source-category')
  assert.equal(result.categoryMoves[0].targetCategoryId, 'source-category')
  assert.equal(result.categoryMerges.length, 0)
})

test('merges category when slug already exists in target organization', () => {
  const result = plan({
    existingTargetCategories: [{ id: 'target-bebidas', name: 'bebidas', slug: 'bebidas' }]
  })

  assert.equal(result.categoryMoves.length, 0)
  assert.equal(result.categoryMerges.length, 1)
  assert.equal(result.categoryMerges[0].sourceCategoryId, 'source-category')
  assert.equal(result.categoryMerges[0].targetCategoryId, 'target-bebidas')
})

test('moves products to existing target category during category merge', () => {
  const result = plan({
    existingTargetCategories: [{ id: 'target-bebidas', name: 'bebidas', slug: 'bebidas' }]
  })

  assert.equal(result.productsMoved, 1)
  assert.equal(result.categoryMerges[0].targetCategoryId, 'target-bebidas')
})

test('marks source category for deletion when merge leaves it empty', () => {
  const result = plan({
    existingTargetCategories: [{ id: 'target-bebidas', name: 'bebidas', slug: 'bebidas' }]
  })

  assert.equal(result.sourceCategoriesDeletedAfterMerge.length, 1)
  assert.equal(result.sourceCategoriesDeletedAfterMerge[0].sourceCategoryId, 'source-category')
})

test('does not mark source category for deletion when it has remaining products', () => {
  const result = plan({
    existingTargetCategories: [{ id: 'target-bebidas', name: 'bebidas', slug: 'bebidas' }],
    sourceCategoryRelations: [{
      sourceCategoryId: 'source-category',
      productCount: 2,
      candidateProductCount: 1,
      halfAndHalfProductCount: 0
    }]
  })

  assert.equal(result.sourceCategoriesDeletedAfterMerge.length, 0)
})

test('does not mark source category for deletion when half-and-half relation remains', () => {
  const result = plan({
    existingTargetCategories: [{ id: 'target-bebidas', name: 'bebidas', slug: 'bebidas' }],
    sourceCategoryRelations: [{
      sourceCategoryId: 'source-category',
      productCount: 1,
      candidateProductCount: 1,
      halfAndHalfProductCount: 1
    }]
  })

  assert.equal(result.sourceCategoriesDeletedAfterMerge.length, 0)
})

test('aborts preflight on product slug conflict before transaction/user changes', () => {
  const result = plan({
    existingTargetProducts: [{
      id: 'target-coca',
      name: 'coca',
      slug: 'gelo',
      catalogCategoryId: 'target-bebidas'
    }]
  })

  assert.equal(result.hasBlockingConflicts, true)
  assert.equal(result.productSlugConflicts.length, 1)
  assert.equal(result.productSlugConflicts[0].code, 'PRODUCT_SLUG_CONFLICT')
})

test('reports candidate counts separately from move and merge counts', () => {
  const result = plan({
    existingTargetCategories: [{ id: 'target-bebidas', name: 'bebidas', slug: 'bebidas' }]
  })

  assert.equal(result.candidateCategories, 1)
  assert.equal(result.candidateProducts, 1)
  assert.equal(result.categoryMoves.length, 0)
  assert.equal(result.categoryMerges.length, 1)
  assert.equal(result.productsMoved, 1)
})
