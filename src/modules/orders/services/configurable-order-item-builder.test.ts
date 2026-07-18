import assert from 'node:assert/strict'
import test from 'node:test'

import { buildConfigurableCatalogOrderItems } from './configurable-order-item-builder.js'

const organizationId = 'org-1'

function makePizza(
  id: string,
  priceInCents: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    organizationId,
    name: id,
    slug: id,
    catalogCategoryId: 'pizzas',
    priceInCents,
    active: true,
    pricingRule: 'STANDARD',
    supportsHalfAndHalf: true,
    canBeUsedAsFlavor: true,
    halfAndHalfFlavorCategoryId: 'pizzas',
    optionGroups: [
      {
        id: 'size-group',
        name: 'Escolha o tamanho',
        key: 'pizza-size',
        required: false,
        minSelections: 0,
        maxSelections: 1,
        options: [
          {
            id: 'size-p',
            key: 'p-4-pedacos',
            name: 'P (4 pedaços)',
            priceDeltaInCents: 0,
            linkedProductId: null,
            active: true,
            sortOrder: 0
          },
          {
            id: 'size-m',
            key: 'm-8-pedacos',
            name: 'M (8 pedaços)',
            priceDeltaInCents: priceInCents,
            linkedProductId: null,
            active: true,
            sortOrder: 1
          }
        ]
      },
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

test('whole pizza uses the product price and does not require a second flavor', async () => {
  const tx = makeTx({
    calabresa: makePizza('calabresa', 6000)
  })

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'calabresa',
        quantity: 1
      }
    ]
  })

  assert.equal(result.subtotalInCents, 6000)
  assert.equal(result.orderItemsData[0].unitPriceInCents, 6000)
  assert.deepEqual(result.orderItemsData[0].flavors.create, [])
})

test('whole pizza adds border after the product price', async () => {
  const tx = makeTx({
    calabresa: makePizza('calabresa', 6000)
  })

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'calabresa',
        quantity: 1,
        selectedOptions: [
          {
            optionGroupId: 'border-group',
            optionIds: ['border-cheese']
          }
        ]
      }
    ]
  })

  assert.equal(result.subtotalInCents, 7000)
})

test('half-and-half uses the highest flavor price in either direction', async () => {
  const tx = makeTx({
    calabresa: makePizza('calabresa', 6000),
    camarao: makePizza('camarao', 8000)
  })

  const lowerFirst = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'calabresa',
        quantity: 1,
        selectedFlavorProductIds: ['camarao']
      }
    ]
  })
  const higherFirst = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'camarao',
        quantity: 1,
        selectedFlavorProductIds: ['calabresa']
      }
    ]
  })

  assert.equal(lowerFirst.subtotalInCents, 8000)
  assert.equal(higherFirst.subtotalInCents, 8000)
  assert.notEqual(lowerFirst.orderItemsData[0].unitPriceInCents, 7000)
  assert.notEqual(lowerFirst.orderItemsData[0].unitPriceInCents, 14000)
  assert.equal(lowerFirst.orderItemsData[0].flavors.create[0].catalogProductId, 'calabresa')
  assert.equal(lowerFirst.orderItemsData[0].flavors.create[1].catalogProductId, 'camarao')
})

test('half-and-half respects the selected size and uses the full price of the most expensive flavor', async () => {
  const tx = makeTx({
    calabresa: makePizza('calabresa', 3000),
    camarao: makePizza('camarao', 4000)
  })

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'calabresa',
        quantity: 1,
        selectedOptions: [
          {
            optionGroupId: 'size-group',
            optionIds: ['size-m']
          }
        ],
        selectedFlavorProductIds: ['camarao']
      }
    ]
  })

  assert.equal(result.orderItemsData[0].unitPriceInCents, 8000)
  assert.equal(result.subtotalInCents, 8000)
  assert.equal(result.orderItemsData[0].flavors.create[0].priceInCents, 6000)
  assert.equal(result.orderItemsData[0].flavors.create[1].priceInCents, 8000)
})

test('half-and-half equal prices and same flavor are allowed', async () => {
  const tx = makeTx({
    calabresa: makePizza('calabresa', 7000)
  })

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'calabresa',
        quantity: 1,
        selectedFlavorProductIds: ['calabresa']
      }
    ]
  })

  assert.equal(result.subtotalInCents, 7000)
  assert.equal(result.orderItemsData[0].flavors.create.length, 2)
})

test('half-and-half adds border after max flavor price and applies quantity at the end', async () => {
  const tx = makeTx({
    calabresa: makePizza('calabresa', 6000),
    camarao: makePizza('camarao', 8000)
  })

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'calabresa',
        quantity: 2,
        selectedFlavorProductIds: ['camarao'],
        selectedOptions: [
          {
            optionGroupId: 'border-group',
            optionIds: ['border-cheese']
          }
        ]
      }
    ]
  })

  assert.equal(result.orderItemsData[0].unitPriceInCents, 9000)
  assert.equal(result.subtotalInCents, 18000)
})

test('rejects invalid half-and-half selections', async () => {
  const tx = makeTx({
    calabresa: makePizza('calabresa', 6000),
    camarao: makePizza('camarao', 8000),
    quatroQueijos: makePizza('quatro-queijos', 7000)
  })

  await assert.rejects(
    () =>
      buildConfigurableCatalogOrderItems({
        tx,
        organizationId,
        items: [
          {
            catalogProductId: 'calabresa',
            quantity: 1,
            selectedFlavorProductIds: ['camarao', 'quatro-queijos']
          }
        ]
      }),
    /Selecione exatamente um segundo sabor/
  )
})

test('rejects inactive, foreign, out-of-category, non-flavor or unsupported products', async () => {
  const tx = makeTx({
    calabresa: makePizza('calabresa', 6000),
    inactive: makePizza('inactive', 8000, { active: false }),
    foreign: makePizza('foreign', 8000, { organizationId: 'org-2' }),
    dessert: makePizza('dessert', 8000, { catalogCategoryId: 'desserts' }),
    combo: makePizza('combo', 8000, { canBeUsedAsFlavor: false }),
    noHalf: makePizza('no-half', 6000, { supportsHalfAndHalf: false })
  })

  for (const flavorId of ['inactive', 'foreign', 'dessert', 'combo']) {
    await assert.rejects(
      () =>
        buildConfigurableCatalogOrderItems({
          tx,
          organizationId,
          items: [
            {
              catalogProductId: 'calabresa',
              quantity: 1,
              selectedFlavorProductIds: [flavorId]
            }
          ]
        }),
      /Sabor inv/
    )
  }

  await assert.rejects(
    () =>
      buildConfigurableCatalogOrderItems({
        tx,
        organizationId,
        items: [
          {
            catalogProductId: 'no-half',
            quantity: 1,
            selectedFlavorProductIds: ['calabresa']
          }
        ]
      }),
    /aceita pizza meio a meio/
  )
})

test('ignores client supplied base price and keeps historical flavor snapshot', async () => {
  const products = {
    calabresa: makePizza('calabresa', 6000),
    camarao: makePizza('camarao', 8000)
  }
  const tx = makeTx(products)

  const result = await buildConfigurableCatalogOrderItems({
    tx,
    organizationId,
    items: [
      {
        catalogProductId: 'calabresa',
        quantity: 1,
        basePriceInCents: 99999,
        selectedFlavorProductIds: ['camarao']
      }
    ]
  })

  assert.equal(result.orderItemsData[0].unitPriceInCents, 8000)
  products.camarao.priceInCents = 9000
  assert.equal(result.orderItemsData[0].flavors.create[1].priceInCents, 8000)
})
