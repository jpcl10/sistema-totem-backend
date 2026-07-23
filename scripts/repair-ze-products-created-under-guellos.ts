import { AuditAction } from '@prisma/client'
import { existsSync } from 'node:fs'

import { prisma } from '../src/lib/prisma.js'

const GUELLOS_SLUG = 'guellos-pizza'
const ZE_SLUG = 'ze-do-facao'
const EXPECTED_GUELLOS_ID = 'cmra0xvea000rvwasonliufxu'
const EXPECTED_ZE_ID = 'cmra0xvdh0000vwas3yfwzxi9'
const HIGOR_USER_ID = 'cmrsawo0d001bmp01pgozcwig'
const HIGOR_EMAIL = 'admin@zedofacao.com.br'
const REPAIR_REASON =
  'Correcao de administrador do Ze do Facao vinculado incorretamente a organizacao Guellos Pizza.'

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

const ZE_CANDIDATE_PRODUCT_NAMES = new Set([
  'queijo extra',
  'bacon na chapa',
  'costela desfiada 100 g',
  'banana caramelizada',
  'gelo',
  'bola de sorvete extra',
  'banana extra',
  'bolinho 3 un chopp 500',
  'espetinho chopp 500',
  'pao de alho chopp 500',
  'burger chopp 770',
  'meia costela chopp 770',
  'costela 400 g 2 chopps 770'
])

const RECENT_BATCH_FROM = new Date('2026-07-18T00:00:00.000Z')

type GroupName = 'A_LEGIT_GUELLOS' | 'B_ZE_UNDER_GUELLOS' | 'C_AMBIGUOUS'

type EvidenceClassification = {
  group: GroupName
  evidence: string[]
  warnings: string[]
}

function isApplyMode() {
  return process.env.APPLY_ZE_GUELLOS_REPAIR === 'true'
}

function requireEnv(name: string, expected?: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for APPLY_ZE_GUELLOS_REPAIR=true`)
  }

  if (expected !== undefined && value !== expected) {
    throw new Error(`${name} mismatch. Expected ${expected}, got ${value}`)
  }

  return value
}

function validateApplyConfirmations(expectedCategoryCount: number, expectedProductCount: number) {
  requireEnv('CONFIRM_USER_EMAIL', HIGOR_EMAIL)
  requireEnv('CONFIRM_SOURCE_ORG_SLUG', GUELLOS_SLUG)
  requireEnv('CONFIRM_TARGET_ORG_SLUG', ZE_SLUG)

  const backupFile = requireEnv('BACKUP_FILE')
  if (!existsSync(backupFile)) {
    throw new Error(`BACKUP_FILE does not exist: ${backupFile}`)
  }

  const categoryCount = Number(requireEnv('EXPECTED_CATEGORY_COUNT'))
  const productCount = Number(requireEnv('EXPECTED_PRODUCT_COUNT'))

  if (categoryCount !== expectedCategoryCount) {
    throw new Error(
      `EXPECTED_CATEGORY_COUNT mismatch. Expected approved ${expectedCategoryCount}, got ${categoryCount}`
    )
  }

  if (productCount !== expectedProductCount) {
    throw new Error(
      `EXPECTED_PRODUCT_COUNT mismatch. Expected approved ${expectedProductCount}, got ${productCount}`
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
  name: string
  categoryClassification: EvidenceClassification
  createdAt: Date
  auditCount: number
  createdByTargetUser: boolean
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

  if (input.createdByTargetUser) {
    evidence.push(`AuditLog vinculado ao usuario ${HIGOR_EMAIL}`)
  }

  if (ZE_CANDIDATE_PRODUCT_NAMES.has(normalizeName(input.name))) {
    evidence.push('nome corresponde a produto informado do novo cardapio do Ze')
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

  if (evidence.length >= 3 && warnings.length === 0) {
    return { group: 'B_ZE_UNDER_GUELLOS', evidence, warnings }
  }

  return { group: 'C_AMBIGUOUS', evidence, warnings }
}

async function main() {
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

  const higor = await prisma.user.findUnique({
    where: { email: HIGOR_EMAIL },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true
    }
  })

  if (!higor) {
    throw new Error(`User not found: ${HIGOR_EMAIL}`)
  }

  if (higor.id !== HIGOR_USER_ID) {
    throw new Error(`Higor userId mismatch. Expected ${HIGOR_USER_ID}, got ${higor.id}`)
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

  const higorAuditLogs = await prisma.auditLog.findMany({
    where: {
      userId: higor.id,
      organizationId: guellos.id
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

  const allRelevantAuditLogs = [...auditLogs, ...higorAuditLogs]
  const auditsByEntityId = new Map<string, typeof allRelevantAuditLogs>()
  for (const log of allRelevantAuditLogs) {
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
      name: product.name,
      categoryClassification,
      createdAt: product.createdAt,
      auditCount: productAudits.length,
      createdByTargetUser: productAudits.some(log => log.userId === higor.id),
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
  const productsCandidateToMove = productReport.filter(
    product => product.classification.group === 'B_ZE_UNDER_GUELLOS'
  )
  const productIdsToMove = new Set(productsCandidateToMove.map(product => product.id))
  const sourceCategoryIdsForMovedProducts = Array.from(
    new Set(productsCandidateToMove.map(product => product.categoryId))
  )
  const categoriesCandidateToMove = categoryReport.filter(category =>
    sourceCategoryIdsForMovedProducts.includes(category.id)
  )
  const unsafeLinkedOptions = productsCandidateToMove.flatMap(product =>
    product.optionGroups.flatMap(group =>
      group.options
        .filter(option => option.linkedProductId && !productIdsToMove.has(option.linkedProductId))
        .map(option => ({
          productId: product.id,
          productName: product.name,
          optionId: option.id,
          optionName: option.name,
          linkedProductId: option.linkedProductId
        }))
    )
  )

  let applyResult: unknown = null

  if (isApplyMode()) {
    validateApplyConfirmations(
      categoriesCandidateToMove.length,
      productsCandidateToMove.length
    )

    if (higor.organizationId !== guellos.id) {
      throw new Error(
        `Refusing apply: ${HIGOR_EMAIL} is not currently linked to Guellos. Current organizationId=${higor.organizationId}`
      )
    }

    if (unsafeLinkedOptions.length > 0) {
      throw new Error(
        `Refusing apply: ${unsafeLinkedOptions.length} option(s) link to products that are not approved to move`
      )
    }

    applyResult = await prisma.$transaction(async tx => {
      const categoryTargetBySourceId = new Map<string, string>()

      for (const category of categoriesCandidateToMove) {
        const allProductsInCategory = productReport.filter(
          product => product.categoryId === category.id
        )
        const canMoveCategoryId =
          category.classification.group === 'B_ZE_UNDER_GUELLOS' &&
          allProductsInCategory.length > 0 &&
          allProductsInCategory.every(
            product => product.classification.group === 'B_ZE_UNDER_GUELLOS'
          )

        if (canMoveCategoryId) {
          await tx.catalogCategory.update({
            where: { id: category.id },
            data: { organizationId: ze.id }
          })
          categoryTargetBySourceId.set(category.id, category.id)
          continue
        }

        const existingTargetCategory = await tx.catalogCategory.findUnique({
          where: {
            organizationId_slug: {
              organizationId: ze.id,
              slug: category.slug
            }
          },
          select: { id: true }
        })

        if (existingTargetCategory) {
          categoryTargetBySourceId.set(category.id, existingTargetCategory.id)
          continue
        }

        const createdTargetCategory = await tx.catalogCategory.create({
          data: {
            organizationId: ze.id,
            name: category.name,
            slug: category.slug,
            sector: category.sector,
            active: category.active,
            sortOrder: category.sortOrder
          },
          select: { id: true }
        })

        categoryTargetBySourceId.set(category.id, createdTargetCategory.id)
      }

      for (const product of productsCandidateToMove) {
        const targetCategoryId = categoryTargetBySourceId.get(product.categoryId)
        if (!targetCategoryId) {
          throw new Error(`No target category for product ${product.id}`)
        }

        await tx.catalogProduct.update({
          where: { id: product.id },
          data: {
            organizationId: ze.id,
            catalogCategoryId: targetCategoryId
          }
        })

        await tx.catalogProductOptionGroup.updateMany({
          where: { productId: product.id },
          data: { organizationId: ze.id }
        })

        await tx.catalogProductOption.updateMany({
          where: { optionGroup: { productId: product.id } },
          data: { organizationId: ze.id }
        })
      }

      const movedProductIds = productsCandidateToMove.map(product => product.id)
      const movedOptionGroupIds = productsCandidateToMove.flatMap(product =>
        product.optionGroups.map(group => group.id)
      )
      const movedOptionIds = productsCandidateToMove.flatMap(product =>
        product.optionGroups.flatMap(group => group.options.map(option => option.id))
      )
      const movedCategoryIds = Array.from(categoryTargetBySourceId.values())
      const movedEntityIds = [
        ...movedProductIds,
        ...movedOptionGroupIds,
        ...movedOptionIds,
        ...movedCategoryIds
      ]

      const guellosEventLinks = await tx.eventProduct.findMany({
        where: {
          catalogProductId: { in: movedProductIds },
          event: { organizationId: guellos.id }
        },
        select: { id: true }
      })

      if (guellosEventLinks.length > 0) {
        await tx.eventProduct.deleteMany({
          where: { id: { in: guellosEventLinks.map(link => link.id) } }
        })
      }

      await tx.auditLog.updateMany({
        where: {
          organizationId: guellos.id,
          entityId: { in: movedEntityIds }
        },
        data: { organizationId: ze.id }
      })

      const updatedUser = await tx.user.update({
        where: { id: higor.id },
        data: {
          organizationId: ze.id,
          sessionVersion: { increment: 1 }
        },
        select: {
          id: true,
          email: true,
          organizationId: true,
          sessionVersion: true
        }
      })

      await tx.auditLog.create({
        data: {
          organizationId: ze.id,
          userId: higor.id,
          entity: 'User',
          entityId: higor.id,
          action: AuditAction.USER_UPDATED,
          description: REPAIR_REASON,
          metadata: {
            previousOrganizationId: guellos.id,
            newOrganizationId: ze.id,
            movedCategoryCount: categoriesCandidateToMove.length,
            movedProductCount: productsCandidateToMove.length,
            removedGuellosEventProductLinks: guellosEventLinks.length,
            backupFile: process.env.BACKUP_FILE
          }
        }
      })

      return {
        updatedUser,
        movedCategoryCount: categoriesCandidateToMove.length,
        movedProductCount: productsCandidateToMove.length,
        removedGuellosEventProductLinks: guellosEventLinks.length
      }
    })
  }

  const report = {
    mode: isApplyMode() ? 'APPLY' : 'DRY_RUN_READ_ONLY',
    appliedChanges: isApplyMode(),
    applyResult,
    organizations: {
      guellos,
      ze
    },
    user: {
      ...higor,
      expectedOrganizationId: ze.id,
      currentlyIncorrectlyLinkedToSourceOrganization: higor.organizationId === guellos.id,
      activePersistentSessions: 'none: this schema has no persistent session or refresh token table',
      tokenInvalidationStrategy:
        'User.sessionVersion is incremented in apply mode; HTTP and Socket.IO reject older JWTs.'
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
      categoriesCandidateToMoveToZe: categoriesCandidateToMove
        .map(category => ({ id: category.id, name: category.name, evidence: category.classification.evidence })),
      productsToKeepInGuellos: productReport
        .filter(product => product.classification.group === 'A_LEGIT_GUELLOS')
        .map(product => ({ id: product.id, name: product.name, categoryName: product.categoryName })),
      productsCandidateToMoveToZe: productsCandidateToMove
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
      ],
      unsafeLinkedOptions,
      realCommand: [
        'APPLY_ZE_GUELLOS_REPAIR=true',
        `CONFIRM_USER_EMAIL=${HIGOR_EMAIL}`,
        `CONFIRM_SOURCE_ORG_SLUG=${GUELLOS_SLUG}`,
        `CONFIRM_TARGET_ORG_SLUG=${ZE_SLUG}`,
        `EXPECTED_CATEGORY_COUNT=${categoriesCandidateToMove.length}`,
        `EXPECTED_PRODUCT_COUNT=${productsCandidateToMove.length}`,
        'BACKUP_FILE=/path/to/approved-backup.sql',
        'node dist/scripts/repair-ze-products-created-under-guellos.js'
      ].join(' ')
    },
    higorAuditLogs,
    auditLogsFromRecentCatalogBatch: allRelevantAuditLogs,
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
