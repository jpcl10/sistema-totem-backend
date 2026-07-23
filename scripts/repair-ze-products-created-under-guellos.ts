import { AuditAction } from '@prisma/client'

import { prisma } from '../src/lib/prisma.js'

const GUELLOS_SLUG = 'guellos-pizza'
const ZE_SLUG = 'ze-do-facao'
const EXPECTED_GUELLOS_ID = 'cmra0xvea000rvwasonliufxu'
const EXPECTED_ZE_ID = 'cmra0xvdh0000vwas3yfwzxi9'

const LEGIT_GUELLOS_CATEGORY_NAMES = new Set([
  'pizzas',
  'promocoes',
  'sucos de 1 litro',
  'refrigerantes',
  'agua',
  'itens do combo'
])

const ZE_CANDIDATE_CATEGORY_NAMES = new Set([
  'bebidas',
  'combos',
  'cozinha',
  'sobremesa',
  'turbine cozinha',
  'adicionais'
])

const RECENT_BATCH_FROM = new Date('2026-07-18T00:00:00.000Z')

type GroupName = 'A_LEGIT_GUELLOS' | 'B_ZE_UNDER_GUELLOS' | 'C_AMBIGUOUS'

type EvidenceClassification = {
  group: GroupName
  evidence: string[]
  warnings: string[]
}

function assertDryRunOnly() {
  if (process.env.APPLY_ZE_GUELLOS_REPAIR === 'true') {
    throw new Error(
      'Real repair is disabled in this diagnostic script. Run without APPLY_ZE_GUELLOS_REPAIR.'
    )
  }
}

function normalizeName(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function safeJson(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => {
      if (inner instanceof Date) return inner.toISOString()
      if (typeof inner === 'bigint') return inner.toString()
      return inner
    })
  )
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1
    return acc
  }, {} as Record<T, number>)
}

function classifyCategory(input: {
  name: string
  slug: string
  createdAt: Date
  productCount: number
  auditCount: number
  createdByUsers: string[]
  eventLinkCount: number
  orderLinkCount: number
}): EvidenceClassification {
  const normalizedName = normalizeName(input.name)
  const normalizedSlug = normalizeName(input.slug)
  const evidence: string[] = []
  const warnings: string[] = []

  if (
    LEGIT_GUELLOS_CATEGORY_NAMES.has(normalizedName) ||
    LEGIT_GUELLOS_CATEGORY_NAMES.has(normalizedSlug)
  ) {
    evidence.push('nome/slug corresponde a categoria historica da Guellos')
    if (input.eventLinkCount > 0 || input.orderLinkCount > 0) {
      evidence.push('possui vinculos de evento/pedido da Guellos')
    }
    return { group: 'A_LEGIT_GUELLOS', evidence, warnings }
  }

  if (
    ZE_CANDIDATE_CATEGORY_NAMES.has(normalizedName) ||
    ZE_CANDIDATE_CATEGORY_NAMES.has(normalizedSlug)
  ) {
    evidence.push('nome/slug corresponde a categoria candidata do cardapio do Ze')
  }

  if (input.createdAt >= RECENT_BATCH_FROM) {
    evidence.push(`createdAt em lote recente: ${input.createdAt.toISOString()}`)
  }

  if (input.auditCount > 0) {
    evidence.push(`possui ${input.auditCount} AuditLog(s) relacionado(s)`)
  }

  if (input.createdByUsers.length > 0) {
    evidence.push(`usuarios de criacao/alteracao: ${input.createdByUsers.join(', ')}`)
  }

  if (input.eventLinkCount > 0 || input.orderLinkCount > 0) {
    warnings.push(
      `possui vinculos operacionais na Guellos: eventos=${input.eventLinkCount}, pedidos=${input.orderLinkCount}`
    )
  }

  if (evidence.length >= 2 && warnings.length === 0) {
    return { group: 'B_ZE_UNDER_GUELLOS', evidence, warnings }
  }

  return { group: 'C_AMBIGUOUS', evidence, warnings }
}

function classifyProduct(input: {
  categoryClassification: EvidenceClassification
  createdAt: Date
  auditCount: number
  eventLinkCount: number
  orderLinkCount: number
  optionGroupCount: number
}): EvidenceClassification {
  const evidence = [...input.categoryClassification.evidence]
  const warnings = [...input.categoryClassification.warnings]

  if (input.createdAt >= RECENT_BATCH_FROM) {
    evidence.push(`produto criado em lote recente: ${input.createdAt.toISOString()}`)
  }

  if (input.auditCount > 0) {
    evidence.push(`produto possui ${input.auditCount} AuditLog(s)`)
  }

  if (input.optionGroupCount > 0) {
    evidence.push(`produto possui ${input.optionGroupCount} grupo(s) de opcoes`)
  }

  if (input.eventLinkCount > 0 || input.orderLinkCount > 0) {
    warnings.push(
      `produto possui vinculos operacionais na Guellos: eventos=${input.eventLinkCount}, pedidos=${input.orderLinkCount}`
    )
  }

  if (input.categoryClassification.group === 'A_LEGIT_GUELLOS') {
    return { group: 'A_LEGIT_GUELLOS', evidence, warnings }
  }

  if (
    input.categoryClassification.group === 'B_ZE_UNDER_GUELLOS' &&
    warnings.length === 0
  ) {
    return { group: 'B_ZE_UNDER_GUELLOS', evidence, warnings }
  }

  return { group: 'C_AMBIGUOUS', evidence, warnings }
}

async function main() {
  assertDryRunOnly()

  const [guellos, ze] = await Promise.all([
    prisma.organization.findUnique({
      where: { slug: GUELLOS_SLUG },
      select: { id: true, slug: true, name: true }
    }),
    prisma.organization.findUnique({
      where: { slug: ZE_SLUG },
      select: { id: true, slug: true, name: true }
    })
  ])

  if (!guellos || !ze) {
    throw new Error('Guellos or Ze organization not found by slug')
  }

  if (guellos.id !== EXPECTED_GUELLOS_ID) {
    throw new Error(
      `Guellos organizationId mismatch. Expected ${EXPECTED_GUELLOS_ID}, got ${guellos.id}`
    )
  }

  if (ze.id !== EXPECTED_ZE_ID) {
    throw new Error(`Ze organizationId mismatch. Expected ${EXPECTED_ZE_ID}, got ${ze.id}`)
  }

  const [guellosCategoryCount, guellosProductCount, zeCategoryCount, zeProductCount] =
    await Promise.all([
      prisma.catalogCategory.count({ where: { organizationId: guellos.id } }),
      prisma.catalogProduct.count({ where: { organizationId: guellos.id } }),
      prisma.catalogCategory.count({ where: { organizationId: ze.id } }),
      prisma.catalogProduct.count({ where: { organizationId: ze.id } })
    ])

  const categories = await prisma.catalogCategory.findMany({
    where: { organizationId: guellos.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      organizationId: true,
      name: true,
      slug: true,
      sector: true,
      active: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } }
    }
  })

  const products = await prisma.catalogProduct.findMany({
    where: { organizationId: guellos.id },
    orderBy: [{ catalogCategory: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      organizationId: true,
      catalogCategoryId: true,
      name: true,
      slug: true,
      description: true,
      priceInCents: true,
      pricingRule: true,
      supportsHalfAndHalf: true,
      canBeUsedAsFlavor: true,
      halfAndHalfFlavorCategoryId: true,
      active: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      catalogCategory: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          slug: true
        }
      },
      optionGroups: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          key: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          options: {
            select: {
              id: true,
              organizationId: true,
              name: true,
              key: true,
              linkedProductId: true,
              priceDeltaInCents: true,
              active: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      },
      eventProducts: {
        select: {
          id: true,
          eventId: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          event: {
            select: {
              id: true,
              organizationId: true,
              name: true,
              slug: true
            }
          }
        }
      },
      orderItems: {
        select: {
          id: true,
          orderId: true,
          productName: true,
          order: {
            select: {
              id: true,
              eventId: true,
              event: { select: { id: true, organizationId: true, name: true, slug: true } }
            }
          }
        }
      },
      onlineOrderItems: {
        select: {
          id: true,
          orderId: true,
          productName: true,
          order: {
            select: {
              id: true,
              storeId: true,
              store: { select: { id: true, organizationId: true, name: true, slug: true } }
            }
          }
        }
      },
      orderItemFlavors: {
        select: { id: true, orderItemId: true, flavorName: true }
      },
      onlineOrderItemFlavors: {
        select: { id: true, onlineOrderItemId: true, flavorName: true }
      },
      linkedProductOptions: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          optionGroupId: true
        }
      }
    }
  })

  const categoryIds = categories.map(category => category.id)
  const productIds = products.map(product => product.id)
  const optionGroupIds = products.flatMap(product => product.optionGroups.map(group => group.id))
  const optionIds = products.flatMap(product =>
    product.optionGroups.flatMap(group => group.options.map(option => option.id))
  )

  const auditEntityIds = [...categoryIds, ...productIds, ...optionGroupIds, ...optionIds]
  const auditLogs = auditEntityIds.length
    ? await prisma.auditLog.findMany({
        where: {
          organizationId: guellos.id,
          OR: [
            { entityId: { in: auditEntityIds } },
            {
              action: {
                in: [
                  AuditAction.PRODUCT_CREATED,
                  AuditAction.PRODUCT_UPDATED,
                  AuditAction.PRODUCT_OPTION_CHANGED,
                  AuditAction.EVENT_PRODUCT_CREATED
                ]
              },
              createdAt: { gte: RECENT_BATCH_FROM }
            }
          ]
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          organizationId: true,
          eventId: true,
          userId: true,
          deviceId: true,
          entity: true,
          entityId: true,
          action: true,
          description: true,
          metadata: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, role: true, organizationId: true } }
        }
      })
    : []

  const auditsByEntityId = new Map<string, typeof auditLogs>()
  for (const log of auditLogs) {
    if (!log.entityId) continue
    const current = auditsByEntityId.get(log.entityId) ?? []
    current.push(log)
    auditsByEntityId.set(log.entityId, current)
  }

  const categoryProducts = new Map<string, typeof products>()
  for (const product of products) {
    const list = categoryProducts.get(product.catalogCategoryId) ?? []
    list.push(product)
    categoryProducts.set(product.catalogCategoryId, list)
  }

  const categoryClassifications = new Map<string, EvidenceClassification>()
  const categoryReport = categories.map(category => {
    const relatedProducts = categoryProducts.get(category.id) ?? []
    const relatedAudits = auditsByEntityId.get(category.id) ?? []
    const productAudits = relatedProducts.flatMap(product => auditsByEntityId.get(product.id) ?? [])
    const createdByUsers = Array.from(
      new Set(
        [...relatedAudits, ...productAudits]
          .map(log => log.user?.email ?? log.user?.name ?? log.userId)
          .filter((value): value is string => Boolean(value))
      )
    )
    const eventLinkCount = relatedProducts.reduce(
      (total, product) => total + product.eventProducts.length,
      0
    )
    const orderLinkCount = relatedProducts.reduce(
      (total, product) =>
        total +
        product.orderItems.length +
        product.onlineOrderItems.length +
        product.orderItemFlavors.length +
        product.onlineOrderItemFlavors.length,
      0
    )
    const classification = classifyCategory({
      name: category.name,
      slug: category.slug,
      createdAt: category.createdAt,
      productCount: category._count.products,
      auditCount: relatedAudits.length + productAudits.length,
      createdByUsers,
      eventLinkCount,
      orderLinkCount
    })
    categoryClassifications.set(category.id, classification)

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      organizationId: category.organizationId,
      createdAt: toIso(category.createdAt),
      updatedAt: toIso(category.updatedAt),
      active: category.active,
      sector: category.sector,
      sortOrder: category.sortOrder,
      productCount: category._count.products,
      contextOrChannel: null,
      createdBy: createdByUsers,
      auditLogs: relatedAudits,
      classification
    }
  })

  const productReport = products.map(product => {
    const productAudits = auditsByEntityId.get(product.id) ?? []
    const categoryClassification =
      categoryClassifications.get(product.catalogCategoryId) ??
      ({ group: 'C_AMBIGUOUS', evidence: [], warnings: [] } satisfies EvidenceClassification)
    const eventLinkCount = product.eventProducts.length
    const orderLinkCount =
      product.orderItems.length +
      product.onlineOrderItems.length +
      product.orderItemFlavors.length +
      product.onlineOrderItemFlavors.length
    const classification = classifyProduct({
      categoryClassification,
      createdAt: product.createdAt,
      auditCount: productAudits.length,
      eventLinkCount,
      orderLinkCount,
      optionGroupCount: product.optionGroups.length
    })

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      organizationId: product.organizationId,
      categoryId: product.catalogCategoryId,
      categoryName: product.catalogCategory.name,
      categoryOrganizationId: product.catalogCategory.organizationId,
      createdAt: toIso(product.createdAt),
      updatedAt: toIso(product.updatedAt),
      priceInCents: product.priceInCents,
      description: product.description,
      active: product.active,
      pricingRule: product.pricingRule,
      supportsHalfAndHalf: product.supportsHalfAndHalf,
      canBeUsedAsFlavor: product.canBeUsedAsFlavor,
      halfAndHalfFlavorCategoryId: product.halfAndHalfFlavorCategoryId,
      createdBy: Array.from(
        new Set(
          productAudits
            .map(log => log.user?.email ?? log.user?.name ?? log.userId)
            .filter((value): value is string => Boolean(value))
        )
      ),
      auditLogs: productAudits,
      optionGroups: product.optionGroups,
      eventLinks: product.eventProducts,
      storeLinks: [],
      orderLinks: {
        eventOrderItems: product.orderItems,
        onlineOrderItems: product.onlineOrderItems,
        eventOrderFlavors: product.orderItemFlavors,
        onlineOrderFlavors: product.onlineOrderItemFlavors
      },
      linkedAsOption: product.linkedProductOptions,
      classification
    }
  })

  const categoryGroups = countBy(categoryReport.map(category => category.classification.group))
  const productGroups = countBy(productReport.map(product => product.classification.group))

  const report = {
    mode: 'DRY_RUN_READ_ONLY',
    appliedChanges: false,
    organizations: {
      guellos,
      ze
    },
    counts: {
      guellos: {
        categoryCount: guellosCategoryCount,
        productCount: guellosProductCount
      },
      ze: {
        categoryCount: zeCategoryCount,
        productCount: zeProductCount
      }
    },
    guellosCategories: categoryReport,
    guellosProductsByCategory: categories.map(category => ({
      categoryId: category.id,
      categoryName: category.name,
      products: productReport.filter(product => product.categoryId === category.id)
    })),
    classificationSummary: {
      categories: categoryGroups,
      products: productGroups
    },
    repairPlan: {
      status: 'not_executed',
      categoriesToKeepInGuellos: categoryReport
        .filter(category => category.classification.group === 'A_LEGIT_GUELLOS')
        .map(category => ({ id: category.id, name: category.name })),
      categoriesCandidateToMoveToZe: categoryReport
        .filter(category => category.classification.group === 'B_ZE_UNDER_GUELLOS')
        .map(category => ({ id: category.id, name: category.name, evidence: category.classification.evidence })),
      productsToKeepInGuellos: productReport
        .filter(product => product.classification.group === 'A_LEGIT_GUELLOS')
        .map(product => ({ id: product.id, name: product.name, categoryName: product.categoryName })),
      productsCandidateToMoveToZe: productReport
        .filter(product => product.classification.group === 'B_ZE_UNDER_GUELLOS')
        .map(product => ({ id: product.id, name: product.name, categoryName: product.categoryName })),
      ambiguousCategories: categoryReport
        .filter(category => category.classification.group === 'C_AMBIGUOUS')
        .map(category => ({ id: category.id, name: category.name, warnings: category.classification.warnings })),
      ambiguousProducts: productReport
        .filter(product => product.classification.group === 'C_AMBIGUOUS')
        .map(product => ({ id: product.id, name: product.name, categoryName: product.categoryName })),
      mergeStrategy:
        'If an equivalent category already exists under Ze, do not duplicate automatically. Review slug/name conflicts and choose merge target before any real migration.',
      safetyRules: [
        'Do not move Guellos order records.',
        'Do not move categories/products with Guellos order or event links without manual approval.',
        'Move category, product, option group and option organizationId together only after review.',
        'Validate every product catalogCategory.organizationId matches product.organizationId after repair.'
      ]
    },
    auditLogsFromRecentCatalogBatch: auditLogs,
    productionCommand:
      'node dist/scripts/repair-ze-products-created-under-guellos.js'
  }

  console.log(JSON.stringify(safeJson(report), null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
