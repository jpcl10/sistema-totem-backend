import assert from 'node:assert/strict'
import test from 'node:test'
import { CatalogProductPricingRule } from '@prisma/client'

import { buildConfigurableCatalogOrderItems } from './configurable-order-item-builder.js'

const organizationId = 'org-1'

function makeFlavor(id: string, priceInCents: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    organizationId,
    name: id,
    slug: id,
    catalogCategoryId: 'flavors',
    priceInCents,
    active: true,
    optionGroups: [],
    ...overrides
  }
}

function makePizza(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pizza',
    organizationId,
    name: 'Pizza Meio a Meio',
    slug: 'pizza-meio-a-meio',
    catalogCategoryId: 'pizzas',
    priceInCents: 5000,
    active: true,
    pricingRule: CatalogProductPricingRule.MAX_SELECTED_FLAVOR,
    halfAndHalfFlavorCategoryId: 'flavors',
    optionGroups: [
      {
        id: 'border-group',
        name: 'Borda',
        required: false,
        minSelections: 0,
        maxSelections: 1,
        options: [
          {
            id: 'border-cheese',
            name: 'Catupiry',
            priceDeltaInCents: 1000,
            linkedProductId: null,
            active: true,
            sortOrder: 0
          }
        ]
      }
    ],
    ...overrides
  }
}

function makeTx(products: Record<string, any>) {
  return {
    catalogProduct: {
      findMany: async ({ where }: any) => {
        const ids: string[] = where.id?.in ?? []
        return Object.values(products).filter((product: any) => {
          if (!ids.includes(product.id)) return false
          if (where.organizationId && product.organizationId !== where.organizationId) return false
          if (where.active !== undefined && product.active !== where.active) return false
          return true
        })
      },
      findFirst: async () => null
    }
  } as any
}

test('max flavor price wins and border is added after it', async () => {
  const tx = makeTx({
    pizza: makePizza(),
    flavor60: makeFlavor('flavor60', 6000),
    flavor80: makeFlavor('flavor80', 8000)
  })

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'pizza',
        quantity: 1,
        selectedFlavorProductIds: ['flavor60', 'flavor80'],
        selectedOptions: [
          {
            optionGroupId: 'border-group',
            optionIds: ['border-cheese']
          }
        ]
      }
    ]
  })

  assert.equal(result.subtotalInCents, 9000)
  assert.equal(result.orderItemsData[0].unitPriceInCents, 9000)
  assert.equal(result.orderItemsData[0].flavors.create[0].priceInCents, 6000)
  assert.equal(result.orderItemsData[0].flavors.create[1].priceInCents, 8000)
})

test('equal flavors keep the shared base price', async () => {
  const tx = makeTx({
    pizza: makePizza(),
    flavor70a: makeFlavor('flavor70a', 7000),
    flavor70b: makeFlavor('flavor70b', 7000)
  })

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'pizza',
        quantity: 1,
        selectedFlavorProductIds: ['flavor70a', 'flavor70b']
      }
    ]
  })

  assert.equal(result.subtotalInCents, 7000)
  assert.equal(result.orderItemsData[0].unitPriceInCents, 7000)
})

test('rejects invalid half-and-half selections', async () => {
  const tx = makeTx({
    pizza: makePizza(),
    flavor60: makeFlavor('flavor60', 6000),
    flavor80: makeFlavor('flavor80', 8000),
    flavor90: makeFlavor('flavor90', 9000)
  })

  await assert.rejects(
    () =>
      buildConfigurableCatalogOrderItems({
        tx,
        organizationId,
        items: [
          {
            catalogProductId: 'pizza',
            quantity: 1,
            selectedFlavorProductIds: ['flavor60']
          }
        ]
      }),
    /Selecione exatamente dois sabores/
  )

  await assert.rejects(
    () =>
      buildConfigurableCatalogOrderItems({
        tx,
        organizationId,
        items: [
          {
            catalogProductId: 'pizza',
            quantity: 1,
            selectedFlavorProductIds: ['flavor60', 'flavor80', 'flavor90']
          }
        ]
      }),
    /Selecione exatamente dois sabores/
  )
})

test('ignores client supplied base price and keeps historical flavor snapshot', async () => {
  const products = {
    pizza: makePizza(),
    flavor60: makeFlavor('flavor60', 6000),
    flavor80: makeFlavor('flavor80', 8000)
  }
  const tx = makeTx(products)

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'pizza',
        quantity: 1,
        basePriceInCents: 99999,
        selectedFlavorProductIds: ['flavor60', 'flavor80']
      }
    ]
  })

  assert.equal(result.orderItemsData[0].unitPriceInCents, 8000)
  products.flavor80.priceInCents = 9999
  assert.equal(result.orderItemsData[0].flavors.create[1].priceInCents, 8000)
})

test('rejects inactive or foreign-organization flavors', async () => {
  const tx = makeTx({
    pizza: makePizza(),
    flavor60: makeFlavor('flavor60', 6000, { active: false }),
    flavor80: makeFlavor('flavor80', 8000, { organizationId: 'org-2' })
  })

  await assert.rejects(
    () =>
      buildConfigurableCatalogOrderItems({
        tx,
        organizationId,
        items: [
          {
            catalogProductId: 'pizza',
            quantity: 1,
            selectedFlavorProductIds: ['flavor60', 'flavor80']
          }
        ]
      }),
    /Sabor inválido ou indisponível/
  )
})
