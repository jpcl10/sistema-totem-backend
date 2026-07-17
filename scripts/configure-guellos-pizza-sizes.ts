import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ORGANIZATION_ID = 'cmra0xvea000rvwasonliufxu'
const DRY_RUN = process.env.DRY_RUN !== 'false'

const COMMON_PIZZA_BASE_PRICE_IN_CENTS = 3000
const COMMON_PIZZA_MEDIUM_DELTA_IN_CENTS = 3000
const PREMIUM_PIZZA_BASE_PRICE_IN_CENTS = 3500
const PREMIUM_PIZZA_MEDIUM_DELTA_IN_CENTS = 3500
const SHRIMP_PIZZA_BASE_PRICE_IN_CENTS = 4000
const SHRIMP_PIZZA_MEDIUM_DELTA_IN_CENTS = 4000
const COMBO_PRICE_IN_CENTS = 7000
const SIZE_GROUP_SORT_ORDER = 0
const BORDER_GROUP_SORT_ORDER = 10

const SIZE_GROUP = {
  name: 'Escolha o tamanho',
  key: 'pizza-size',
  required: true,
  minSelections: 1,
  maxSelections: 1,
  active: true,
  sortOrder: SIZE_GROUP_SORT_ORDER
}

const SIZE_OPTIONS = [
  {
    name: 'P (4 pedaços)',
    key: 'p-4-pedacos',
    priceDeltaInCents: 0,
    active: true,
    sortOrder: 0
  },
  {
    name: 'M (8 pedaços)',
    key: 'm-8-pedacos',
    active: true,
    sortOrder: 1
  }
]

const SPECIAL_PRICES = new Map([
  ['carne-de-sol', {
    base: PREMIUM_PIZZA_BASE_PRICE_IN_CENTS,
    mDelta: PREMIUM_PIZZA_MEDIUM_DELTA_IN_CENTS
  }],
  ['costela-desfiada', {
    base: PREMIUM_PIZZA_BASE_PRICE_IN_CENTS,
    mDelta: PREMIUM_PIZZA_MEDIUM_DELTA_IN_CENTS
  }],
  ['camarao', {
    base: SHRIMP_PIZZA_BASE_PRICE_IN_CENTS,
    mDelta: SHRIMP_PIZZA_MEDIUM_DELTA_IN_CENTS
  }]
])

const DEFAULT_PRICE = {
  base: COMMON_PIZZA_BASE_PRICE_IN_CENTS,
  mDelta: COMMON_PIZZA_MEDIUM_DELTA_IN_CENTS
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function priceForProduct(slug: string) {
  return SPECIAL_PRICES.get(slug) ?? DEFAULT_PRICE
}

async function collectState(tx: any) {
  const category = await tx.catalogCategory.findFirst({
    where: {
      organizationId: ORGANIZATION_ID,
      OR: [
        { slug: 'pizzas-grandes' },
        { slug: 'pizzas' },
        { name: 'Pizzas Grandes' },
        { name: 'Pizzas' }
      ]
    },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      sortOrder: true
    }
  })

  assertCondition(category, 'Pizza category not found')

  const pizzas = await tx.catalogProduct.findMany({
    where: {
      organizationId: ORGANIZATION_ID,
      catalogCategoryId: category.id
    },
    include: {
      optionGroups: {
        include: {
          options: {
            orderBy: {
              sortOrder: 'asc'
            }
          }
        },
        orderBy: {
          sortOrder: 'asc'
        }
      }
    },
    orderBy: {
      sortOrder: 'asc'
    }
  })

  assertCondition(pizzas.length === 13, `Expected 13 pizzas, found ${pizzas.length}`)

  const combo = await tx.catalogProduct.findFirst({
    where: {
      organizationId: ORGANIZATION_ID,
      slug: 'combo-pizza-refrigerante'
    },
    include: {
      optionGroups: {
        include: {
          options: {
            include: {
              linkedProduct: {
                select: {
                  id: true,
                  slug: true,
                  name: true
                }
              }
            },
            orderBy: {
              sortOrder: 'asc'
            }
          }
        },
        orderBy: {
          sortOrder: 'asc'
        }
      }
    }
  })

  assertCondition(combo, 'Combo Pizza + Refrigerante not found')

  const borderSnapshot = pizzas.map((pizza: any) => {
    const borderGroup = pizza.optionGroups.find(
      (group: any) => group.key === 'escolha-borda'
    )

    return {
      productId: pizza.id,
      productSlug: pizza.slug,
      groupId: borderGroup?.id ?? null,
      sortOrder: borderGroup?.sortOrder ?? null,
      options: borderGroup?.options.map((option: any) => ({
        id: option.id,
        key: option.key,
        priceDeltaInCents: option.priceDeltaInCents
      })) ?? []
    }
  })

  return {
    category,
    pizzas,
    combo,
    borderSnapshot
  }
}

function buildPlan(state: any) {
  const categoryUpdate = {
    id: state.category.id,
    from: {
      name: state.category.name,
      slug: state.category.slug
    },
    to: {
      name: 'Pizzas',
      slug: 'pizzas'
    },
    willUpdate:
      state.category.name !== 'Pizzas' ||
      state.category.slug !== 'pizzas'
  }

  const pizzaPlans = state.pizzas.map((pizza: any) => {
    const price = priceForProduct(pizza.slug)
    const sizeGroup = pizza.optionGroups.find(
      (group: any) => group.key === SIZE_GROUP.key
    )
    const borderGroup = pizza.optionGroups.find(
      (group: any) => group.key === 'escolha-borda'
    )

    const existingP = sizeGroup?.options.find(
      (option: any) => option.key === 'p-4-pedacos'
    )
    const existingM = sizeGroup?.options.find(
      (option: any) => option.key === 'm-8-pedacos'
    )

    return {
      id: pizza.id,
      name: pizza.name,
      slug: pizza.slug,
      currentPriceInCents: pizza.priceInCents,
      targetPriceInCents: price.base,
      sizeGroup: sizeGroup
        ? {
            action: 'update',
            id: sizeGroup.id,
            currentSortOrder: sizeGroup.sortOrder,
            targetSortOrder: SIZE_GROUP.sortOrder
          }
        : {
            action: 'create',
            key: SIZE_GROUP.key
          },
      sizeOptions: [
        {
          key: 'p-4-pedacos',
          action: existingP ? 'update' : 'create',
          currentPriceDeltaInCents: existingP?.priceDeltaInCents ?? null,
          targetPriceDeltaInCents: 0
        },
        {
          key: 'm-8-pedacos',
          action: existingM ? 'update' : 'create',
          currentPriceDeltaInCents: existingM?.priceDeltaInCents ?? null,
          targetPriceDeltaInCents: price.mDelta
        }
      ],
      borderGroup: borderGroup
        ? {
            id: borderGroup.id,
            currentSortOrder: borderGroup.sortOrder,
            targetSortOrder: BORDER_GROUP_SORT_ORDER,
            pricesPreserved: borderGroup.options.map((option: any) => ({
              key: option.key,
              priceDeltaInCents: option.priceDeltaInCents
            }))
          }
        : null
    }
  })

  const comboPizzaGroup = state.combo.optionGroups.find(
    (group: any) => group.key === 'escolha-pizza'
  )

  return {
    categoryUpdate,
    pizzas: pizzaPlans,
    summary: {
      pizzas: pizzaPlans.length,
      sizeGroupsToCreate: pizzaPlans.filter(
        (plan: any) => plan.sizeGroup.action === 'create'
      ).length,
      sizeGroupsToUpdate: pizzaPlans.filter(
        (plan: any) => plan.sizeGroup.action === 'update'
      ).length,
      sizeOptionsToCreate: pizzaPlans.reduce(
        (total: number, plan: any) =>
          total + plan.sizeOptions.filter((option: any) => option.action === 'create').length,
        0
      ),
      sizeOptionsToUpdate: pizzaPlans.reduce(
        (total: number, plan: any) =>
          total + plan.sizeOptions.filter((option: any) => option.action === 'update').length,
        0
      )
    },
    comboImpact: {
      id: state.combo.id,
      name: state.combo.name,
      slug: state.combo.slug,
      priceInCents: state.combo.priceInCents,
      willChangePrice: false,
      willAddSizeGroup: false,
      pizzaSelectionGroupId: comboPizzaGroup?.id ?? null,
      linkedPizzaOptions: comboPizzaGroup?.options.map((option: any) => ({
        id: option.id,
        key: option.key,
        priceDeltaInCents: option.priceDeltaInCents,
        linkedProductId: option.linkedProductId,
        linkedProductSlug: option.linkedProduct?.slug ?? null
      })) ?? [],
      backendBehavior:
        'linkedProduct is used only for snapshot name; linked product option groups are not expanded and their size price is not added to combo orders.'
    }
  }
}

async function applyChanges(tx: any, state: any) {
  await tx.catalogCategory.update({
    where: {
      id: state.category.id
    },
    data: {
      name: 'Pizzas',
      slug: 'pizzas'
    }
  })

  for (const pizza of state.pizzas) {
    const price = priceForProduct(pizza.slug)

    await tx.catalogProduct.update({
      where: {
        id: pizza.id
      },
      data: {
        priceInCents: price.base
      }
    })

    const sizeGroup = await tx.catalogProductOptionGroup.upsert({
      where: {
        productId_key: {
          productId: pizza.id,
          key: SIZE_GROUP.key
        }
      },
      create: {
        organizationId: ORGANIZATION_ID,
        productId: pizza.id,
        ...SIZE_GROUP
      },
      update: SIZE_GROUP
    })

    await tx.catalogProductOption.upsert({
      where: {
        optionGroupId_key: {
          optionGroupId: sizeGroup.id,
          key: 'p-4-pedacos'
        }
      },
      create: {
        organizationId: ORGANIZATION_ID,
        optionGroupId: sizeGroup.id,
        ...SIZE_OPTIONS[0]
      },
      update: SIZE_OPTIONS[0]
    })

    await tx.catalogProductOption.upsert({
      where: {
        optionGroupId_key: {
          optionGroupId: sizeGroup.id,
          key: 'm-8-pedacos'
        }
      },
      create: {
        organizationId: ORGANIZATION_ID,
        optionGroupId: sizeGroup.id,
        ...SIZE_OPTIONS[1],
        priceDeltaInCents: price.mDelta
      },
      update: {
        ...SIZE_OPTIONS[1],
        priceDeltaInCents: price.mDelta
      }
    })

    const borderGroup = pizza.optionGroups.find(
      (group: any) => group.key === 'escolha-borda'
    )

    if (borderGroup) {
      await tx.catalogProductOptionGroup.update({
        where: {
          id: borderGroup.id
        },
        data: {
          sortOrder: BORDER_GROUP_SORT_ORDER
        }
      })
    }
  }
}

async function validate(tx: any, originalState: any) {
  const state = await collectState(tx)

  assertCondition(
    state.category.id === originalState.category.id,
    'Pizza category ID changed'
  )
  assertCondition(state.category.name === 'Pizzas', 'Pizza category name was not updated')
  assertCondition(state.category.slug === 'pizzas', 'Pizza category slug was not updated')
  assertCondition(state.pizzas.length === 13, 'Pizza product count changed')

  for (const pizza of state.pizzas) {
    const price = priceForProduct(pizza.slug)
    const sizeGroups = pizza.optionGroups.filter(
      (group: any) => group.key === SIZE_GROUP.key && group.active
    )
    assertCondition(
      sizeGroups.length === 1,
      `Pizza ${pizza.slug} does not have exactly one active size group`
    )

    const sizeGroup = sizeGroups[0]
    const options = sizeGroup.options.filter((option: any) =>
      ['p-4-pedacos', 'm-8-pedacos'].includes(option.key)
    )
    assertCondition(
      options.length === 2,
      `Pizza ${pizza.slug} does not have exactly P and M options`
    )

    const p = options.find((option: any) => option.key === 'p-4-pedacos')
    const m = options.find((option: any) => option.key === 'm-8-pedacos')
    assertCondition(p?.priceDeltaInCents === 0, `Pizza ${pizza.slug} P price is invalid`)
    assertCondition(
      m?.priceDeltaInCents === price.mDelta,
      `Pizza ${pizza.slug} M price is invalid`
    )
    assertCondition(
      pizza.priceInCents === price.base,
      `Pizza ${pizza.slug} base price is invalid`
    )

    const borderGroup = pizza.optionGroups.find(
      (group: any) => group.key === 'escolha-borda'
    )
    assertCondition(borderGroup, `Pizza ${pizza.slug} lost border group`)
    assertCondition(
      sizeGroup.sortOrder < borderGroup.sortOrder,
      `Pizza ${pizza.slug} size group does not come before border group`
    )

    const originalBorder = originalState.borderSnapshot.find(
      (snapshot: any) => snapshot.productId === pizza.id
    )
    assertCondition(originalBorder, `Missing original border snapshot for ${pizza.slug}`)

    for (const option of borderGroup.options) {
      const originalOption = originalBorder.options.find(
        (snapshot: any) => snapshot.id === option.id
      )
      assertCondition(
        originalOption?.priceDeltaInCents === option.priceDeltaInCents,
        `Border option price changed for ${pizza.slug}/${option.key}`
      )
    }
  }

  assertCondition(state.combo.priceInCents === COMBO_PRICE_IN_CENTS, 'Combo price changed')

  const comboPizzaGroup = state.combo.optionGroups.find(
    (group: any) => group.key === 'escolha-pizza'
  )
  assertCondition(comboPizzaGroup, 'Combo lost pizza selection group')

  const invalidLinkedOptions = comboPizzaGroup.options.filter(
    (option: any) => option.linkedProductId && !option.linkedProduct
  )
  assertCondition(
    invalidLinkedOptions.length === 0,
    'Combo has invalid linkedProductId'
  )

  return {
    categoryId: state.category.id,
    categoryName: state.category.name,
    categorySlug: state.category.slug,
    pizzas: state.pizzas.length,
    comboPriceInCents: state.combo.priceInCents,
    comboLinkedOptions: comboPizzaGroup.options.length
  }
}

async function main() {
  const result = await prisma.$transaction(async tx => {
    const state = await collectState(tx)
    const plan = buildPlan(state)

    if (DRY_RUN) {
      return {
        dryRun: true,
        committed: false,
        plan
      }
    }

    await applyChanges(tx, state)
    const validation = await validate(tx, state)

    return {
      dryRun: false,
      committed: true,
      validation
    }
  })

  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
