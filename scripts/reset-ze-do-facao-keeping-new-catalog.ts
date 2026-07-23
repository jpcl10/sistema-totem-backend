import 'dotenv/config'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ZE_SLUG = 'ze-do-facao'
const GUELLOS_SLUG = 'guellos-pizza'
const EXPECTED_ZE_ID = 'cmra0xvdh0000vwas3yfwzxi9'
const EXPECTED_GUELLOS_ID = 'cmra0xvea000rvwasonliufxu'

const defaultReportDir = resolve(process.cwd(), 'repair-reports')

type Org = {
  id: string
  name: string
  slug: string
  createdAt: Date
  updatedAt: Date
}

type CountMap = Record<string, number>

type PreserveProduct = {
  id: string
  name: string
  slug: string
  categoryId: string
  categoryName: string
  priceInCents: number
  createdAt: Date
  updatedAt: Date
  organizationId: string
  auditCreatedAt: Date | null
  auditUserId: string | null
}

function envFlag(name: string) {
  return process.env[name] === 'true'
}

function envString(name: string) {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function startOfYesterdayLocal() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
}

function endOfYesterdayLocal() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function numberFrom(value: unknown) {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

function redactUrl(url: string | undefined) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return {
      protocol: parsed.protocol.replace(':', ''),
      hostname: parsed.hostname,
      port: parsed.port || null,
      database: parsed.pathname.replace(/^\//, '') || null,
      searchParams: Array.from(parsed.searchParams.keys()).sort()
    }
  } catch {
    return '[invalid DATABASE_URL]'
  }
}

function normalizeJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (typeof item === 'bigint') return Number(item)
      if (item instanceof Date) return item.toISOString()
      return item
    })
  )
}

async function raw<T = Record<string, unknown>>(
  query: TemplateStringsArray,
  ...values: unknown[]
) {
  return prisma.$queryRaw<T[]>(query, ...values)
}

async function scalarString(query: TemplateStringsArray, ...values: unknown[]) {
  const rows = await raw<Record<string, unknown>>(query, ...values)
  const first = rows[0]
  if (!first) return null
  return String(Object.values(first)[0] ?? '')
}

async function resolveOrganizations() {
  const [ze, guellos] = await Promise.all([
    prisma.organization.findUnique({ where: { slug: ZE_SLUG } }),
    prisma.organization.findUnique({ where: { slug: GUELLOS_SLUG } })
  ])

  if (!ze) throw new Error(`Organization not found by slug: ${ZE_SLUG}`)
  if (!guellos) throw new Error(`Organization not found by slug: ${GUELLOS_SLUG}`)
  if (ze.id !== EXPECTED_ZE_ID) {
    throw new Error(`Zé ID changed. Expected ${EXPECTED_ZE_ID}, found ${ze.id}`)
  }
  if (guellos.id !== EXPECTED_GUELLOS_ID) {
    throw new Error(`Guellos ID changed. Expected ${EXPECTED_GUELLOS_ID}, found ${guellos.id}`)
  }

  return {
    ze: ze as Org,
    guellos: guellos as Org
  }
}

async function collectDbInfo() {
  const [database, schema] = await Promise.all([
    scalarString`SELECT current_database() AS database`,
    scalarString`SELECT current_schema() AS schema`
  ])

  const migrationRows = await raw<{ total: bigint; last_started_at: Date | null }>`
    SELECT COUNT(*) AS total, MAX("started_at") AS last_started_at
    FROM "_prisma_migrations"
  `.catch(() => [])

  return {
    database,
    schema,
    databaseUrl: redactUrl(process.env.DATABASE_URL),
    environment: process.env.NODE_ENV ?? null,
    backendCommit:
      process.env.EASYPANEL_GIT_COMMIT ??
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.COMMIT_SHA ??
      null,
    migrations: migrationRows[0]
      ? {
          total: numberFrom(migrationRows[0].total),
          lastStartedAt: migrationRows[0].last_started_at
        }
      : null
  }
}

async function countDirect(model: string, organizationId: string) {
  const rows = await raw<{ total: bigint }>`
    SELECT COUNT(*) AS total
    FROM "${Prisma.raw(model)}"
    WHERE "organizationId" = ${organizationId}
  `
  return numberFrom(rows[0]?.total)
}

async function collectTenantCounts(organizationId: string): Promise<CountMap> {
  const directModels = [
    'CatalogCategory',
    'CatalogProduct',
    'CatalogProductOptionGroup',
    'CatalogProductOption',
    'Event',
    'OnlineStore',
    'PaymentTransaction',
    'BusinessHour',
    'BusinessHourException',
    'Customer',
    'CustomerAddress',
    'Device',
    'AuditLog',
    'NfcCard',
    'NfcCardRead',
    'NfcCardTransaction',
    'OnlineStoreSettings',
    'DeliveryFeeRule',
    'EventClosing'
  ]

  const counts: CountMap = {}
  for (const model of directModels) {
    counts[model] = await countDirect(model, organizationId)
  }

  const relationCounts = await raw<{ key: string; total: bigint }>`
    SELECT 'Order' AS key, COUNT(o.*) AS total
      FROM "Order" o JOIN "Event" e ON e.id = o."eventId"
      WHERE e."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'OrderItem' AS key, COUNT(oi.*) AS total
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Event" e ON e.id = o."eventId"
      WHERE e."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'OrderItemOption' AS key, COUNT(oio.*) AS total
      FROM "OrderItemOption" oio JOIN "OrderItem" oi ON oi.id = oio."orderItemId"
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Event" e ON e.id = o."eventId"
      WHERE e."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'OrderItemFlavor' AS key, COUNT(oif.*) AS total
      FROM "OrderItemFlavor" oif JOIN "OrderItem" oi ON oi.id = oif."orderItemId"
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Event" e ON e.id = o."eventId"
      WHERE e."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'EventProduct' AS key, COUNT(ep.*) AS total
      FROM "EventProduct" ep JOIN "Event" e ON e.id = ep."eventId"
      WHERE e."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'EventPrinter' AS key, COUNT(p.*) AS total
      FROM "EventPrinter" p JOIN "Event" e ON e.id = p."eventId"
      WHERE e."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'EventPrintJob' AS key, COUNT(j.*) AS total
      FROM "EventPrintJob" j
      LEFT JOIN "Event" e ON e.id = j."eventId"
      LEFT JOIN "OnlineStore" s ON s.id = j."storeId"
      LEFT JOIN "Order" o ON o.id = j."orderId"
      LEFT JOIN "Event" oe ON oe.id = o."eventId"
      LEFT JOIN "OnlineOrder" oo ON oo.id = j."onlineOrderId"
      LEFT JOIN "OnlineStore" os ON os.id = oo."storeId"
      WHERE COALESCE(e."organizationId", s."organizationId", oe."organizationId", os."organizationId") = ${organizationId}
    UNION ALL
    SELECT 'OnlineCategory' AS key, COUNT(c.*) AS total
      FROM "OnlineCategory" c JOIN "OnlineStore" s ON s.id = c."storeId"
      WHERE s."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'OnlineProduct' AS key, COUNT(p.*) AS total
      FROM "OnlineProduct" p JOIN "OnlineStore" s ON s.id = p."storeId"
      WHERE s."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'OnlineOrder' AS key, COUNT(o.*) AS total
      FROM "OnlineOrder" o JOIN "OnlineStore" s ON s.id = o."storeId"
      WHERE s."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'OnlineOrderItem' AS key, COUNT(oi.*) AS total
      FROM "OnlineOrderItem" oi JOIN "OnlineOrder" o ON o.id = oi."orderId"
      JOIN "OnlineStore" s ON s.id = o."storeId"
      WHERE s."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'OnlineOrderItemOption' AS key, COUNT(oio.*) AS total
      FROM "OnlineOrderItemOption" oio JOIN "OnlineOrderItem" oi ON oi.id = oio."onlineOrderItemId"
      JOIN "OnlineOrder" o ON o.id = oi."orderId"
      JOIN "OnlineStore" s ON s.id = o."storeId"
      WHERE s."organizationId" = ${organizationId}
    UNION ALL
    SELECT 'OnlineOrderItemFlavor' AS key, COUNT(oif.*) AS total
      FROM "OnlineOrderItemFlavor" oif JOIN "OnlineOrderItem" oi ON oi.id = oif."onlineOrderItemId"
      JOIN "OnlineOrder" o ON o.id = oi."orderId"
      JOIN "OnlineStore" s ON s.id = o."storeId"
      WHERE s."organizationId" = ${organizationId}
  `

  for (const row of relationCounts) counts[row.key] = numberFrom(row.total)
  return counts
}

async function collectPreservedCatalog(organizationId: string, from: Date, to: Date) {
  const products = await raw<PreserveProduct>`
    SELECT
      cp.id,
      cp.name,
      cp.slug,
      cp."catalogCategoryId" AS "categoryId",
      cc.name AS "categoryName",
      cp."priceInCents",
      cp."createdAt",
      cp."updatedAt",
      cp."organizationId",
      MIN(al."createdAt") AS "auditCreatedAt",
      MIN(al."userId") AS "auditUserId"
    FROM "CatalogProduct" cp
    JOIN "CatalogCategory" cc ON cc.id = cp."catalogCategoryId"
    LEFT JOIN "AuditLog" al
      ON al."organizationId" = cp."organizationId"
     AND al.entity = 'CatalogProduct'
     AND al."entityId" = cp.id
     AND al.action = 'PRODUCT_CREATED'
    WHERE cp."organizationId" = ${organizationId}
      AND cc."organizationId" = ${organizationId}
      AND (
        cp."createdAt" >= ${from} AND cp."createdAt" < ${to}
        OR al."createdAt" >= ${from} AND al."createdAt" < ${to}
      )
    GROUP BY cp.id, cc.id
    ORDER BY cc.name, cp."sortOrder", cp.name
  `

  if (products.length === 0) {
    throw new Error(
      `No preserved Zé catalog products found between ${from.toISOString()} and ${to.toISOString()}`
    )
  }

  const productIds = products.map(product => product.id)
  const categoryIds = Array.from(new Set(products.map(product => product.categoryId)))

  const categories = await prisma.catalogCategory.findMany({
    where: {
      organizationId,
      id: { in: categoryIds }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } }
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  })

  const optionGroups = await prisma.catalogProductOptionGroup.findMany({
    where: {
      organizationId,
      productId: { in: productIds }
    },
    select: {
      id: true,
      productId: true,
      name: true,
      key: true,
      createdAt: true,
      updatedAt: true,
      options: {
        select: {
          id: true,
          name: true,
          key: true,
          priceDeltaInCents: true,
          linkedProductId: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      }
    },
    orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
  })

  const invalidLinkedOptions = optionGroups.flatMap(group =>
    group.options.filter(
      option => option.linkedProductId && !productIds.includes(option.linkedProductId)
    )
  )

  if (invalidLinkedOptions.length > 0) {
    throw new Error(
      `Preserved options link to products outside the preserved batch: ${invalidLinkedOptions
        .map(option => option.id)
        .join(', ')}`
    )
  }

  return {
    products,
    categories,
    optionGroups,
    productIds,
    categoryIds
  }
}

async function collectCrossTenantIssues(zeId: string, guellosId: string) {
  const ids = [zeId, guellosId]
  return {
    catalogProductVsCategory: await raw`
      SELECT cp.id, cp.name, cp."organizationId" AS "productOrganizationId",
             cc.id AS "categoryId", cc.name AS "categoryName",
             cc."organizationId" AS "categoryOrganizationId"
      FROM "CatalogProduct" cp
      JOIN "CatalogCategory" cc ON cc.id = cp."catalogCategoryId"
      WHERE cp."organizationId" <> cc."organizationId"
        AND (cp."organizationId" IN (${Prisma.join(ids)}) OR cc."organizationId" IN (${Prisma.join(ids)}))
      ORDER BY cp."createdAt" DESC
    `,
    eventProductVsEvent: await raw`
      SELECT ep.id, ep."eventId", ep."catalogProductId",
             e."organizationId" AS "eventOrganizationId",
             cp."organizationId" AS "catalogProductOrganizationId",
             e.name AS "eventName", cp.name AS "productName"
      FROM "EventProduct" ep
      JOIN "Event" e ON e.id = ep."eventId"
      JOIN "CatalogProduct" cp ON cp.id = ep."catalogProductId"
      WHERE e."organizationId" <> cp."organizationId"
        AND (e."organizationId" IN (${Prisma.join(ids)}) OR cp."organizationId" IN (${Prisma.join(ids)}))
      ORDER BY ep."createdAt" DESC
    `,
    optionGroupVsProduct: await raw`
      SELECT g.id, g.name, g."organizationId" AS "groupOrganizationId",
             cp.id AS "productId", cp.name AS "productName",
             cp."organizationId" AS "productOrganizationId"
      FROM "CatalogProductOptionGroup" g
      JOIN "CatalogProduct" cp ON cp.id = g."productId"
      WHERE g."organizationId" <> cp."organizationId"
        AND (g."organizationId" IN (${Prisma.join(ids)}) OR cp."organizationId" IN (${Prisma.join(ids)}))
      ORDER BY g."createdAt" DESC
    `,
    optionVsGroup: await raw`
      SELECT o.id, o.name, o."organizationId" AS "optionOrganizationId",
             g.id AS "groupId", g.name AS "groupName",
             g."organizationId" AS "groupOrganizationId"
      FROM "CatalogProductOption" o
      JOIN "CatalogProductOptionGroup" g ON g.id = o."optionGroupId"
      WHERE o."organizationId" <> g."organizationId"
        AND (o."organizationId" IN (${Prisma.join(ids)}) OR g."organizationId" IN (${Prisma.join(ids)}))
      ORDER BY o."createdAt" DESC
    `,
    zeProductsLinkedToGuellos: await raw`
      SELECT cp.id, cp.name, cp."createdAt", cp."organizationId",
             ep.id AS "eventProductId", e.id AS "eventId", e.name AS "eventName",
             e."organizationId" AS "eventOrganizationId"
      FROM "CatalogProduct" cp
      LEFT JOIN "EventProduct" ep ON ep."catalogProductId" = cp.id
      LEFT JOIN "Event" e ON e.id = ep."eventId"
      WHERE cp."organizationId" = ${zeId}
        AND e."organizationId" = ${guellosId}
      ORDER BY cp."createdAt" DESC
    `,
    guellosProductsLinkedToZe: await raw`
      SELECT cp.id, cp.name, cp."createdAt", cp."organizationId",
             ep.id AS "eventProductId", e.id AS "eventId", e.name AS "eventName",
             e."organizationId" AS "eventOrganizationId"
      FROM "CatalogProduct" cp
      LEFT JOIN "EventProduct" ep ON ep."catalogProductId" = cp.id
      LEFT JOIN "Event" e ON e.id = ep."eventId"
      WHERE cp."organizationId" = ${guellosId}
        AND e."organizationId" = ${zeId}
      ORDER BY cp."createdAt" DESC
    `
  }
}

async function collectDeletionPlan(zeId: string, preservedProductIds: string[], preservedCategoryIds: string[]) {
  const oldProducts = await prisma.catalogProduct.findMany({
    where: {
      organizationId: zeId,
      id: { notIn: preservedProductIds }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      catalogCategoryId: true,
      priceInCents: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          eventProducts: true,
          orderItems: true,
          onlineOrderItems: true,
          optionGroups: true
        }
      }
    },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
  })

  const oldCategories = await prisma.catalogCategory.findMany({
    where: {
      organizationId: zeId,
      id: { notIn: preservedCategoryIds },
      products: {
        none: {
          id: { in: preservedProductIds }
        }
      }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } }
    },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
  })

  const [events, stores, customers] = await Promise.all([
    prisma.event.findMany({
      where: { organizationId: zeId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            eventProducts: true,
            printJobs: true,
            printers: true,
            devices: true
          }
        }
      },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    }),
    prisma.onlineStore.findMany({
      where: { organizationId: zeId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            products: true,
            categories: true,
            printJobs: true,
            devices: true
          }
        }
      },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    }),
    prisma.customer.findMany({
      where: { organizationId: zeId },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            onlineOrders: true,
            addresses: true
          }
        }
      },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    })
  ])

  const deletionCounts = await collectTenantCounts(zeId)

  return {
    events,
    stores,
    customers,
    oldProducts,
    oldCategories,
    deletionCounts,
    plannedDeletes: {
      operationalData: [
        'OrderItemOption',
        'OrderItemFlavor',
        'OrderItem',
        'OnlineOrderItemOption',
        'OnlineOrderItemFlavor',
        'OnlineOrderItem',
        'PaymentTransaction',
        'EventPrintJob',
        'Order',
        'OnlineOrder',
        'EventProduct',
        'EventPrinter',
        'EventClosing',
        'NfcCardRead',
        'NfcCardTransaction',
        'NfcCard',
        'Event',
        'OnlineProduct',
        'OnlineCategory',
        'OnlineStoreSettings',
        'DeliveryFeeRule',
        'OnlineStore',
        'CustomerInterest',
        'CustomerAddress',
        'Customer'
      ],
      oldCatalog: [
        'CatalogProductOption',
        'CatalogProductOptionGroup',
        'CatalogProduct',
        'CatalogCategory only when not preserved and empty'
      ]
    }
  }
}

async function executeReset(zeId: string, preservedProductIds: string[], preservedCategoryIds: string[]) {
  const oldProductIds = (
    await prisma.catalogProduct.findMany({
      where: {
        organizationId: zeId,
        id: { notIn: preservedProductIds }
      },
      select: { id: true }
    })
  ).map(product => product.id)

  const zeEventIds = (
    await prisma.event.findMany({
      where: { organizationId: zeId },
      select: { id: true }
    })
  ).map(event => event.id)

  const zeStoreIds = (
    await prisma.onlineStore.findMany({
      where: { organizationId: zeId },
      select: { id: true }
    })
  ).map(store => store.id)

  const zeOrderIds = zeEventIds.length
    ? (
        await prisma.order.findMany({
          where: { eventId: { in: zeEventIds } },
          select: { id: true }
        })
      ).map(order => order.id)
    : []

  const zeOnlineOrderIds = zeStoreIds.length
    ? (
        await prisma.onlineOrder.findMany({
          where: { storeId: { in: zeStoreIds } },
          select: { id: true }
        })
      ).map(order => order.id)
    : []

  const zeCustomerIds = (
    await prisma.customer.findMany({
      where: { organizationId: zeId },
      select: { id: true }
    })
  ).map(customer => customer.id)

  const result = await prisma.$transaction(async tx => {
    const counts: CountMap = {}

    async function remember(label: string, promise: Promise<{ count: number }>) {
      const outcome = await promise
      counts[label] = outcome.count
    }

    if (zeOrderIds.length > 0) {
      const zeOrderItemIds = (
        await tx.orderItem.findMany({
          where: { orderId: { in: zeOrderIds } },
          select: { id: true }
        })
      ).map(item => item.id)

      if (zeOrderItemIds.length > 0) {
        await remember(
          'OrderItemOption',
          tx.orderItemOption.deleteMany({ where: { orderItemId: { in: zeOrderItemIds } } })
        )
        await remember(
          'OrderItemFlavor',
          tx.orderItemFlavor.deleteMany({ where: { orderItemId: { in: zeOrderItemIds } } })
        )
      }

      await remember('OrderItem', tx.orderItem.deleteMany({ where: { orderId: { in: zeOrderIds } } }))
    }

    if (zeOnlineOrderIds.length > 0) {
      const zeOnlineOrderItemIds = (
        await tx.onlineOrderItem.findMany({
          where: { orderId: { in: zeOnlineOrderIds } },
          select: { id: true }
        })
      ).map(item => item.id)

      if (zeOnlineOrderItemIds.length > 0) {
        await remember(
          'OnlineOrderItemOption',
          tx.onlineOrderItemOption.deleteMany({
            where: { onlineOrderItemId: { in: zeOnlineOrderItemIds } }
          })
        )
        await remember(
          'OnlineOrderItemFlavor',
          tx.onlineOrderItemFlavor.deleteMany({
            where: { onlineOrderItemId: { in: zeOnlineOrderItemIds } }
          })
        )
      }

      await remember(
        'OnlineOrderItem',
        tx.onlineOrderItem.deleteMany({ where: { orderId: { in: zeOnlineOrderIds } } })
      )
    }

    await remember('PaymentRefund', tx.paymentRefund.deleteMany({ where: { organizationId: zeId } }))
    await remember(
      'PaymentTransaction',
      tx.paymentTransaction.deleteMany({ where: { organizationId: zeId } })
    )

    await remember(
      'EventPrintJob',
      tx.eventPrintJob.deleteMany({
        where: {
          OR: [
            zeEventIds.length ? { eventId: { in: zeEventIds } } : { id: '__never__' },
            zeStoreIds.length ? { storeId: { in: zeStoreIds } } : { id: '__never__' },
            zeOrderIds.length ? { orderId: { in: zeOrderIds } } : { id: '__never__' },
            zeOnlineOrderIds.length ? { onlineOrderId: { in: zeOnlineOrderIds } } : { id: '__never__' }
          ]
        }
      })
    )

    if (zeOrderIds.length > 0) {
      await remember('Order', tx.order.deleteMany({ where: { id: { in: zeOrderIds } } }))
    }
    if (zeOnlineOrderIds.length > 0) {
      await remember(
        'OnlineOrder',
        tx.onlineOrder.deleteMany({ where: { id: { in: zeOnlineOrderIds } } })
      )
    }

    await remember('EventProduct', tx.eventProduct.deleteMany({ where: { eventId: { in: zeEventIds } } }))
    await remember('EventPrinter', tx.eventPrinter.deleteMany({ where: { eventId: { in: zeEventIds } } }))
    await remember('EventClosing', tx.eventClosing.deleteMany({ where: { organizationId: zeId } }))
    await remember('NfcCardRead', tx.nfcCardRead.deleteMany({ where: { organizationId: zeId } }))
    await remember(
      'NfcCardTransaction',
      tx.nfcCardTransaction.deleteMany({ where: { organizationId: zeId } })
    )
    await remember('NfcCard', tx.nfcCard.deleteMany({ where: { organizationId: zeId } }))

    await remember(
      'Device operational links',
      tx.device.deleteMany({
        where: {
          organizationId: zeId,
          OR: [{ eventId: { not: null } }, { storeId: { not: null } }]
        }
      })
    )

    await remember('Event', tx.event.deleteMany({ where: { organizationId: zeId } }))

    await remember(
      'OnlineProduct',
      tx.onlineProduct.deleteMany({ where: { storeId: { in: zeStoreIds } } })
    )
    await remember(
      'OnlineCategory',
      tx.onlineCategory.deleteMany({ where: { storeId: { in: zeStoreIds } } })
    )
    await remember(
      'OnlineStoreSettings',
      tx.onlineStoreSettings.deleteMany({ where: { organizationId: zeId } })
    )
    await remember('DeliveryFeeRule', tx.deliveryFeeRule.deleteMany({ where: { organizationId: zeId } }))
    await remember(
      'BusinessHour store scoped',
      tx.businessHour.deleteMany({
        where: {
          organizationId: zeId,
          storeId: { in: zeStoreIds }
        }
      })
    )
    await remember(
      'BusinessHourException store scoped',
      tx.businessHourException.deleteMany({
        where: {
          organizationId: zeId,
          storeId: { in: zeStoreIds }
        }
      })
    )
    await remember('OnlineStore', tx.onlineStore.deleteMany({ where: { organizationId: zeId } }))

    if (zeCustomerIds.length > 0) {
      await remember(
        'CustomerInterest',
        tx.customerInterest.deleteMany({ where: { customerId: { in: zeCustomerIds } } })
      )
    }
    await remember('CustomerAddress', tx.customerAddress.deleteMany({ where: { organizationId: zeId } }))
    await remember('Customer', tx.customer.deleteMany({ where: { organizationId: zeId } }))

    if (oldProductIds.length > 0) {
      const oldOptionGroupIds = (
        await tx.catalogProductOptionGroup.findMany({
          where: {
            organizationId: zeId,
            productId: { in: oldProductIds }
          },
          select: { id: true }
        })
      ).map(group => group.id)

      await remember(
        'CatalogProductOption old product groups',
        tx.catalogProductOption.deleteMany({
          where: {
            organizationId: zeId,
            OR: [
              oldOptionGroupIds.length ? { optionGroupId: { in: oldOptionGroupIds } } : { id: '__never__' },
              { linkedProductId: { in: oldProductIds } }
            ]
          }
        })
      )
      await remember(
        'CatalogProductOptionGroup old products',
        tx.catalogProductOptionGroup.deleteMany({
          where: {
            organizationId: zeId,
            productId: { in: oldProductIds }
          }
        })
      )
      await remember(
        'CatalogProduct old',
        tx.catalogProduct.deleteMany({
          where: {
            organizationId: zeId,
            id: { in: oldProductIds }
          }
        })
      )
    }

    await remember(
      'CatalogCategory old empty',
      tx.catalogCategory.deleteMany({
        where: {
          organizationId: zeId,
          id: { notIn: preservedCategoryIds },
          products: { none: {} },
          halfAndHalfProducts: { none: {} }
        }
      })
    )

    return counts
  })

  return result
}

async function assertBackupForApply() {
  const backupPath = envString('BACKUP_FILE')
  if (!backupPath) {
    throw new Error('BACKUP_FILE is required for APPLY_ZE_RESET=true')
  }
  const info = await stat(backupPath)
  if (!info.isFile() || info.size <= 0) {
    throw new Error(`BACKUP_FILE is missing or empty: ${backupPath}`)
  }
  return {
    path: backupPath,
    sizeBytes: info.size
  }
}

async function assertApplyGuards(preservedCount: number, dbInfo: Awaited<ReturnType<typeof collectDbInfo>>) {
  if (!envFlag('APPLY_ZE_RESET')) return null

  if (envString('CONFIRM_ORGANIZATION_SLUG') !== ZE_SLUG) {
    throw new Error('CONFIRM_ORGANIZATION_SLUG=ze-do-facao is required')
  }
  if (!envFlag('CONFIRM_KEEP_NEW_CATALOG')) {
    throw new Error('CONFIRM_KEEP_NEW_CATALOG=true is required')
  }
  const expectedCount = Number(envString('EXPECTED_PRESERVED_PRODUCT_COUNT'))
  if (!Number.isInteger(expectedCount) || expectedCount !== preservedCount) {
    throw new Error(
      `EXPECTED_PRESERVED_PRODUCT_COUNT must equal preserved count (${preservedCount})`
    )
  }
  const expectedDatabase = envString('CONFIRM_DATABASE_NAME')
  if (expectedDatabase && dbInfo.database !== expectedDatabase) {
    throw new Error(
      `Connected database mismatch. Expected ${expectedDatabase}, found ${dbInfo.database}`
    )
  }

  return assertBackupForApply()
}

async function main() {
  const repairBatchId = `ze-reset-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const dryRun = !envFlag('APPLY_ZE_RESET')
  const preserveFrom = envString('PRESERVE_CREATED_FROM')
    ? new Date(envString('PRESERVE_CREATED_FROM') as string)
    : startOfYesterdayLocal()
  const preserveTo = envString('PRESERVE_CREATED_TO')
    ? new Date(envString('PRESERVE_CREATED_TO') as string)
    : endOfYesterdayLocal()

  if (Number.isNaN(preserveFrom.getTime()) || Number.isNaN(preserveTo.getTime())) {
    throw new Error('Invalid PRESERVE_CREATED_FROM/PRESERVE_CREATED_TO')
  }
  if (preserveFrom >= preserveTo) {
    throw new Error('PRESERVE_CREATED_FROM must be before PRESERVE_CREATED_TO')
  }

  const dbInfo = await collectDbInfo()
  const organizations = await resolveOrganizations()
  const preservedCatalog = await collectPreservedCatalog(
    organizations.ze.id,
    preserveFrom,
    preserveTo
  )
  const backup = await assertApplyGuards(preservedCatalog.products.length, dbInfo)

  const [guellosBeforeCounts, zeBeforeCounts, deletionPlan, crossTenantIssues] =
    await Promise.all([
      collectTenantCounts(organizations.guellos.id),
      collectTenantCounts(organizations.ze.id),
      collectDeletionPlan(
        organizations.ze.id,
        preservedCatalog.productIds,
        preservedCatalog.categoryIds
      ),
      collectCrossTenantIssues(organizations.ze.id, organizations.guellos.id)
    ])

  const report = {
    repairBatchId,
    generatedAt: new Date().toISOString(),
    mode: dryRun ? 'DRY_RUN_READ_ONLY' : 'APPLY',
    database: dbInfo,
    backup: dryRun
      ? {
          status: 'planned-before-apply',
          commandHint:
            'Execute pg_dump inside the real API/Postgres environment and pass BACKUP_FILE=/path/to/file.sql before APPLY_ZE_RESET=true.'
        }
      : backup,
    organizations,
    preserveWindow: {
      from: preserveFrom,
      to: preserveTo,
      note: 'Defaults to yesterday in the process local timezone. Override with PRESERVE_CREATED_FROM/PRESERVE_CREATED_TO ISO timestamps if production timezone differs.'
    },
    preservedCatalog: {
      productCount: preservedCatalog.products.length,
      products: preservedCatalog.products,
      categoryCount: preservedCatalog.categories.length,
      categories: preservedCatalog.categories,
      optionGroupCount: preservedCatalog.optionGroups.length,
      optionGroups: preservedCatalog.optionGroups
    },
    deletionPlan,
    tenantSafety: {
      guellosBeforeCounts,
      zeBeforeCounts,
      crossTenantIssues,
      criticalAbortConditions: [
        'Any planned delete includes Guellos organizationId',
        'Preserved product count differs from EXPECTED_PRESERVED_PRODUCT_COUNT in apply mode',
        'Connected database differs from CONFIRM_DATABASE_NAME when provided',
        'Backup file missing or empty in apply mode',
        'Preserved option links to a product outside the preserved batch'
      ]
    },
    applyCommand: [
      'APPLY_ZE_RESET=true',
      'CONFIRM_ORGANIZATION_SLUG=ze-do-facao',
      'CONFIRM_KEEP_NEW_CATALOG=true',
      `EXPECTED_PRESERVED_PRODUCT_COUNT=${preservedCatalog.products.length}`,
      'CONFIRM_DATABASE_NAME=<current_database()>',
      'BACKUP_FILE=<validated-pg-dump-path>',
      'node dist/scripts/reset-ze-do-facao-keeping-new-catalog.js'
    ].join(' ')
  }

  const reportDir = envString('REPAIR_REPORT_DIR') ?? defaultReportDir
  await mkdir(reportDir, { recursive: true })
  const reportPath = resolve(reportDir, `${repairBatchId}.json`)
  await writeFile(reportPath, `${JSON.stringify(normalizeJson(report), null, 2)}\n`)

  if (!dryRun) {
    const guellosBeforeJson = JSON.stringify(normalizeJson(guellosBeforeCounts))
    const appliedDeletes = await executeReset(
      organizations.ze.id,
      preservedCatalog.productIds,
      preservedCatalog.categoryIds
    )
    const guellosAfterCounts = await collectTenantCounts(organizations.guellos.id)
    const guellosAfterJson = JSON.stringify(normalizeJson(guellosAfterCounts))

    if (guellosBeforeJson !== guellosAfterJson) {
      throw new Error(
        `Guellos counts changed unexpectedly after reset. Before=${guellosBeforeJson}; after=${guellosAfterJson}`
      )
    }

    const applyReportPath = resolve(reportDir, `${repairBatchId}.apply.json`)
    await writeFile(
      applyReportPath,
      `${JSON.stringify(
        normalizeJson({
          ...report,
          appliedDeletes,
          guellosAfterCounts,
          applyCompletedAt: new Date().toISOString()
        }),
        null,
        2
      )}\n`
    )
    console.log(JSON.stringify(normalizeJson({ ...report, reportPath, appliedDeletes, applyReportPath }), null, 2))
    return
  }

  console.log(JSON.stringify(normalizeJson({ ...report, reportPath }), null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
