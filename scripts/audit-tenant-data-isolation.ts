import 'dotenv/config'
import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SAMPLE_LIMIT = Number(process.env.AUDIT_SAMPLE_LIMIT ?? 25)
const PRODUCT_NAMES = [
  'Portuguesa',
  'Calabresa',
  'Frango com Catupiry',
  'Carne de Sol',
  'Camarão',
  'Camarao',
  'Costela Desfiada'
]

type OrganizationSummary = {
  id: string
  name: string
  slug: string
  active: boolean | null
  createdAt: Date
  updatedAt: Date
}

type TenantPair = {
  guellos: OrganizationSummary
  zeDoFacao: OrganizationSummary
}

async function raw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]) {
  return prisma.$queryRaw<T[]>(query, ...values)
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeRows(rows: unknown[]) {
  return JSON.parse(
    JSON.stringify(rows, (key, value) => {
      if (typeof value === 'bigint') {
        return Number(value)
      }

      if (
        [
          'password',
          'email',
          'phone',
          'customerPhone',
          'contactEmail',
          'contactPhone',
          'whatsapp',
          'document',
          'normalizedDocument',
          'accessToken',
          'publicKey',
          'webhookSecret',
          'encryptedCredentials',
          'pixKey',
          'qrCode',
          'qrCodeBase64',
          'pixCopyPaste',
          'deliveryAddress',
          'deliveryNumber',
          'deliveryComplement',
          'deliveryReference',
          'street',
          'number',
          'complement',
          'reference',
          'recipientName'
        ].includes(key)
      ) {
        return value == null ? value : '[REDACTED]'
      }

      return value
    })
  )
}

async function findOrganizations(): Promise<TenantPair> {
  const organizations = await prisma.organization.findMany({
    where: {
      OR: [
        { slug: 'guellos-pizza' },
        { name: { contains: 'Guellos', mode: 'insensitive' } },
        { name: { contains: 'Facão', mode: 'insensitive' } },
        { name: { contains: 'Facao', mode: 'insensitive' } },
        { slug: { contains: 'facao', mode: 'insensitive' } },
        { slug: { contains: 'facão', mode: 'insensitive' } },
        { slug: { contains: 'ze-', mode: 'insensitive' } }
      ]
    },
    orderBy: [{ createdAt: 'asc' }]
  })

  const mapped = organizations.map(organization => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    active: Object.prototype.hasOwnProperty.call(organization, 'active')
      ? (organization as { active?: boolean }).active ?? null
      : null,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt
  }))

  const guellos = mapped.find(
    organization =>
      organization.slug === 'guellos-pizza' || normalizeText(organization.name).includes('guellos')
  )
  const zeDoFacao = mapped.find(organization => {
    const normalizedName = normalizeText(organization.name)
    const normalizedSlug = normalizeText(organization.slug)
    return normalizedName.includes('ze do facao') || normalizedSlug.includes('ze-do-facao')
  })

  if (!guellos || !zeDoFacao) {
    throw new Error(
      `Could not identify both organizations. Candidates: ${JSON.stringify(mapped, null, 2)}`
    )
  }

  return { guellos, zeDoFacao }
}

async function countByOrganization(model: string, organizationIds: string[]) {
  return raw<{ organizationId: string; total: bigint }>`
    SELECT "organizationId", COUNT(*) AS total
    FROM "${Prisma.raw(model)}"
    WHERE "organizationId" IN (${Prisma.join(organizationIds)})
    GROUP BY "organizationId"
    ORDER BY "organizationId"
  `
}

async function sampleByOrganization(model: string, organizationIds: string[]) {
  return raw`
    SELECT *
    FROM "${Prisma.raw(model)}"
    WHERE "organizationId" IN (${Prisma.join(organizationIds)})
    ORDER BY "createdAt" DESC NULLS LAST, "id"
    LIMIT ${SAMPLE_LIMIT}
  `
}

async function collectCounts(pair: TenantPair) {
  const ids = [pair.guellos.id, pair.zeDoFacao.id]
  const directModels = [
    'User',
    'OrganizationModule',
    'CatalogCategory',
    'CatalogProduct',
    'CatalogProductOptionGroup',
    'CatalogProductOption',
    'Event',
    'OnlineStore',
    'PaymentTransaction',
    'PaymentProviderCredential',
    'ContextPaymentSettings',
    'BusinessHour',
    'BusinessHourException',
    'AuditLog',
    'NfcCard',
    'NfcCardRead',
    'NfcCardTransaction',
    'Customer',
    'CustomerAddress',
    'Device',
    'OnlineStoreSettings',
    'DeliveryFeeRule',
    'PaymentTerminal',
    'PaymentRefund',
    'PaymentWebhookEvent',
    'PaymentSettingsMigrationConflict',
    'EventClosing'
  ]

  const result: Record<string, unknown> = {}

  for (const model of directModels) {
    try {
      result[model] = {
        totals: normalizeRows(await countByOrganization(model, ids)),
        samples: normalizeRows(await sampleByOrganization(model, ids))
      }
    } catch (error) {
      result[model] = { error: error instanceof Error ? error.message : String(error) }
    }
  }

  result.Order = normalizeRows(await raw`
    SELECT e."organizationId", COUNT(o.*) AS total
    FROM "Order" o
    JOIN "Event" e ON e.id = o."eventId"
    WHERE e."organizationId" IN (${Prisma.join(ids)})
    GROUP BY e."organizationId"
  `)
  result.OrderItem = normalizeRows(await raw`
    SELECT e."organizationId", COUNT(oi.*) AS total
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "Event" e ON e.id = o."eventId"
    WHERE e."organizationId" IN (${Prisma.join(ids)})
    GROUP BY e."organizationId"
  `)
  result.EventProduct = normalizeRows(await raw`
    SELECT e."organizationId", COUNT(ep.*) AS total
    FROM "EventProduct" ep
    JOIN "Event" e ON e.id = ep."eventId"
    WHERE e."organizationId" IN (${Prisma.join(ids)})
    GROUP BY e."organizationId"
  `)
  result.EventPrintJob = normalizeRows(await raw`
    SELECT COALESCE(e."organizationId", s."organizationId") AS "organizationId", COUNT(j.*) AS total
    FROM "EventPrintJob" j
    LEFT JOIN "Event" e ON e.id = j."eventId"
    LEFT JOIN "OnlineStore" s ON s.id = j."storeId"
    WHERE COALESCE(e."organizationId", s."organizationId") IN (${Prisma.join(ids)})
    GROUP BY COALESCE(e."organizationId", s."organizationId")
  `)
  result.EventPrinter = normalizeRows(await raw`
    SELECT e."organizationId", COUNT(p.*) AS total
    FROM "EventPrinter" p
    JOIN "Event" e ON e.id = p."eventId"
    WHERE e."organizationId" IN (${Prisma.join(ids)})
    GROUP BY e."organizationId"
  `)
  result.OnlineCategory = normalizeRows(await raw`
    SELECT s."organizationId", COUNT(c.*) AS total
    FROM "OnlineCategory" c
    JOIN "OnlineStore" s ON s.id = c."storeId"
    WHERE s."organizationId" IN (${Prisma.join(ids)})
    GROUP BY s."organizationId"
  `)
  result.OnlineProduct = normalizeRows(await raw`
    SELECT s."organizationId", COUNT(p.*) AS total
    FROM "OnlineProduct" p
    JOIN "OnlineStore" s ON s.id = p."storeId"
    WHERE s."organizationId" IN (${Prisma.join(ids)})
    GROUP BY s."organizationId"
  `)
  result.OnlineOrder = normalizeRows(await raw`
    SELECT s."organizationId", COUNT(o.*) AS total
    FROM "OnlineOrder" o
    JOIN "OnlineStore" s ON s.id = o."storeId"
    WHERE s."organizationId" IN (${Prisma.join(ids)})
    GROUP BY s."organizationId"
  `)
  result.OnlineOrderItem = normalizeRows(await raw`
    SELECT s."organizationId", COUNT(oi.*) AS total
    FROM "OnlineOrderItem" oi
    JOIN "OnlineOrder" o ON o.id = oi."orderId"
    JOIN "OnlineStore" s ON s.id = o."storeId"
    WHERE s."organizationId" IN (${Prisma.join(ids)})
    GROUP BY s."organizationId"
  `)

  return result
}

async function collectCrossTenantIssues(pair: TenantPair) {
  const ids = [pair.guellos.id, pair.zeDoFacao.id]
  const checks: Record<string, unknown[]> = {}

  checks.eventProductEventVsCatalogProduct = normalizeRows(await raw`
    SELECT ep.id, ep."eventId", ep."catalogProductId",
      e."organizationId" AS "eventOrganizationId",
      cp."organizationId" AS "catalogProductOrganizationId",
      e.name AS "eventName", e.slug AS "eventSlug",
      cp.name AS "productName", cp.slug AS "productSlug"
    FROM "EventProduct" ep
    JOIN "Event" e ON e.id = ep."eventId"
    JOIN "CatalogProduct" cp ON cp.id = ep."catalogProductId"
    WHERE e."organizationId" <> cp."organizationId"
      AND (e."organizationId" IN (${Prisma.join(ids)}) OR cp."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY ep."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.catalogProductVsCategory = normalizeRows(await raw`
    SELECT cp.id, cp.name, cp.slug, cp."organizationId" AS "productOrganizationId",
      cc.id AS "categoryId", cc.name AS "categoryName", cc."organizationId" AS "categoryOrganizationId"
    FROM "CatalogProduct" cp
    JOIN "CatalogCategory" cc ON cc.id = cp."catalogCategoryId"
    WHERE cp."organizationId" <> cc."organizationId"
      AND (cp."organizationId" IN (${Prisma.join(ids)}) OR cc."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY cp."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.optionGroupVsProduct = normalizeRows(await raw`
    SELECT g.id, g.name, g."organizationId" AS "groupOrganizationId",
      cp.id AS "productId", cp.name AS "productName", cp."organizationId" AS "productOrganizationId"
    FROM "CatalogProductOptionGroup" g
    JOIN "CatalogProduct" cp ON cp.id = g."productId"
    WHERE g."organizationId" <> cp."organizationId"
      AND (g."organizationId" IN (${Prisma.join(ids)}) OR cp."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY g."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.optionVsGroup = normalizeRows(await raw`
    SELECT o.id, o.name, o."organizationId" AS "optionOrganizationId",
      g.id AS "groupId", g.name AS "groupName", g."organizationId" AS "groupOrganizationId"
    FROM "CatalogProductOption" o
    JOIN "CatalogProductOptionGroup" g ON g.id = o."optionGroupId"
    WHERE o."organizationId" <> g."organizationId"
      AND (o."organizationId" IN (${Prisma.join(ids)}) OR g."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY o."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.optionLinkedProduct = normalizeRows(await raw`
    SELECT o.id, o.name, o."organizationId" AS "optionOrganizationId",
      cp.id AS "linkedProductId", cp.name AS "linkedProductName", cp."organizationId" AS "linkedProductOrganizationId"
    FROM "CatalogProductOption" o
    JOIN "CatalogProduct" cp ON cp.id = o."linkedProductId"
    WHERE o."linkedProductId" IS NOT NULL
      AND o."organizationId" <> cp."organizationId"
      AND (o."organizationId" IN (${Prisma.join(ids)}) OR cp."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY o."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.orderDeviceCustomerVsEvent = normalizeRows(await raw`
    SELECT o.id, o."eventId", e."organizationId" AS "eventOrganizationId",
      d.id AS "deviceId", d."organizationId" AS "deviceOrganizationId",
      c.id AS "customerId", c."organizationId" AS "customerOrganizationId"
    FROM "Order" o
    JOIN "Event" e ON e.id = o."eventId"
    LEFT JOIN "Device" d ON d.id = o."deviceId"
    LEFT JOIN "Customer" c ON c.id = o."customerId"
    WHERE (d.id IS NOT NULL AND d."organizationId" <> e."organizationId")
       OR (c.id IS NOT NULL AND c."organizationId" <> e."organizationId")
      AND e."organizationId" IN (${Prisma.join(ids)})
    ORDER BY o."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.orderItemCatalogProductVsOrderEvent = normalizeRows(await raw`
    SELECT oi.id, oi."orderId", oi."catalogProductId", oi."productName",
      e."organizationId" AS "orderOrganizationId",
      cp."organizationId" AS "catalogProductOrganizationId",
      cp.name AS "catalogProductName"
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "Event" e ON e.id = o."eventId"
    JOIN "CatalogProduct" cp ON cp.id = oi."catalogProductId"
    WHERE oi."catalogProductId" IS NOT NULL
      AND e."organizationId" <> cp."organizationId"
      AND (e."organizationId" IN (${Prisma.join(ids)}) OR cp."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY o."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.onlineOrderItemCatalogProductVsStore = normalizeRows(await raw`
    SELECT oi.id, oi."orderId", oi."catalogProductId", oi."productName",
      s."organizationId" AS "storeOrganizationId",
      cp."organizationId" AS "catalogProductOrganizationId",
      cp.name AS "catalogProductName"
    FROM "OnlineOrderItem" oi
    JOIN "OnlineOrder" o ON o.id = oi."orderId"
    JOIN "OnlineStore" s ON s.id = o."storeId"
    JOIN "CatalogProduct" cp ON cp.id = oi."catalogProductId"
    WHERE oi."catalogProductId" IS NOT NULL
      AND s."organizationId" <> cp."organizationId"
      AND (s."organizationId" IN (${Prisma.join(ids)}) OR cp."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY o."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.onlineProductVsCategoryStore = normalizeRows(await raw`
    SELECT p.id, p.name, p."storeId" AS "productStoreId", p."categoryId",
      s."organizationId" AS "productStoreOrganizationId",
      c."storeId" AS "categoryStoreId",
      cs."organizationId" AS "categoryStoreOrganizationId"
    FROM "OnlineProduct" p
    JOIN "OnlineStore" s ON s.id = p."storeId"
    JOIN "OnlineCategory" c ON c.id = p."categoryId"
    JOIN "OnlineStore" cs ON cs.id = c."storeId"
    WHERE p."storeId" <> c."storeId"
       OR s."organizationId" <> cs."organizationId"
      AND (s."organizationId" IN (${Prisma.join(ids)}) OR cs."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY p."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.onlineOrderRelationsVsStore = normalizeRows(await raw`
    SELECT o.id, o."storeId", s."organizationId" AS "storeOrganizationId",
      c.id AS "customerId", c."organizationId" AS "customerOrganizationId",
      ca.id AS "customerAddressId", ca."organizationId" AS "customerAddressOrganizationId",
      dfr.id AS "deliveryRuleId", dfr."organizationId" AS "deliveryRuleOrganizationId"
    FROM "OnlineOrder" o
    JOIN "OnlineStore" s ON s.id = o."storeId"
    LEFT JOIN "Customer" c ON c.id = o."customerId"
    LEFT JOIN "CustomerAddress" ca ON ca.id = o."customerAddressId"
    LEFT JOIN "DeliveryFeeRule" dfr ON dfr.id = o."deliveryRuleId"
    WHERE (c.id IS NOT NULL AND c."organizationId" <> s."organizationId")
       OR (ca.id IS NOT NULL AND ca."organizationId" <> s."organizationId")
       OR (dfr.id IS NOT NULL AND dfr."organizationId" <> s."organizationId")
      AND s."organizationId" IN (${Prisma.join(ids)})
    ORDER BY o."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.deviceVsEventStore = normalizeRows(await raw`
    SELECT d.id, d.name, d."organizationId" AS "deviceOrganizationId",
      e.id AS "eventId", e."organizationId" AS "eventOrganizationId",
      s.id AS "storeId", s."organizationId" AS "storeOrganizationId"
    FROM "Device" d
    LEFT JOIN "Event" e ON e.id = d."eventId"
    LEFT JOIN "OnlineStore" s ON s.id = d."storeId"
    WHERE (e.id IS NOT NULL AND d."organizationId" <> e."organizationId")
       OR (s.id IS NOT NULL AND d."organizationId" <> s."organizationId")
      AND d."organizationId" IN (${Prisma.join(ids)})
    ORDER BY d."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.printJobRelations = normalizeRows(await raw`
    SELECT j.id, j."eventId", j."orderId", j."storeId", j."onlineOrderId", j."printerId", j."deviceId",
      e."organizationId" AS "eventOrganizationId",
      oe."organizationId" AS "orderEventOrganizationId",
      s."organizationId" AS "storeOrganizationId",
      os."organizationId" AS "onlineOrderStoreOrganizationId",
      pe."organizationId" AS "printerEventOrganizationId",
      d."organizationId" AS "deviceOrganizationId"
    FROM "EventPrintJob" j
    LEFT JOIN "Event" e ON e.id = j."eventId"
    LEFT JOIN "Order" o ON o.id = j."orderId"
    LEFT JOIN "Event" oe ON oe.id = o."eventId"
    LEFT JOIN "OnlineStore" s ON s.id = j."storeId"
    LEFT JOIN "OnlineOrder" oo ON oo.id = j."onlineOrderId"
    LEFT JOIN "OnlineStore" os ON os.id = oo."storeId"
    LEFT JOIN "EventPrinter" p ON p.id = j."printerId"
    LEFT JOIN "Event" pe ON pe.id = p."eventId"
    LEFT JOIN "Device" d ON d.id = j."deviceId"
    WHERE cardinality(array_remove(ARRAY[
      e."organizationId", oe."organizationId", s."organizationId", os."organizationId", pe."organizationId", d."organizationId"
    ], NULL)) > 1
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.businessHoursVsStore = normalizeRows(await raw`
    SELECT bh.id, bh."organizationId" AS "businessHourOrganizationId", bh."storeId",
      s."organizationId" AS "storeOrganizationId"
    FROM "BusinessHour" bh
    JOIN "OnlineStore" s ON s.id = bh."storeId"
    WHERE bh."storeId" IS NOT NULL
      AND bh."organizationId" <> s."organizationId"
      AND (bh."organizationId" IN (${Prisma.join(ids)}) OR s."organizationId" IN (${Prisma.join(ids)}))
    ORDER BY bh."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.paymentTransactions = normalizeRows(await raw`
    SELECT pt.id, pt."organizationId" AS "paymentOrganizationId",
      e."organizationId" AS "eventOrganizationId",
      s."organizationId" AS "storeOrganizationId",
      oe."organizationId" AS "orderEventOrganizationId",
      os."organizationId" AS "onlineOrderStoreOrganizationId",
      d."organizationId" AS "deviceOrganizationId"
    FROM "PaymentTransaction" pt
    LEFT JOIN "Event" e ON e.id = pt."eventId"
    LEFT JOIN "OnlineStore" s ON s.id = pt."storeId"
    LEFT JOIN "Order" o ON o.id = pt."orderId"
    LEFT JOIN "Event" oe ON oe.id = o."eventId"
    LEFT JOIN "OnlineOrder" oo ON oo.id = pt."onlineOrderId"
    LEFT JOIN "OnlineStore" os ON os.id = oo."storeId"
    LEFT JOIN "Device" d ON d.id = pt."deviceId"
    WHERE cardinality(array_remove(ARRAY[
      pt."organizationId", e."organizationId", s."organizationId", oe."organizationId", os."organizationId", d."organizationId"
    ], NULL)) > 1
      AND pt."organizationId" IN (${Prisma.join(ids)})
    ORDER BY pt."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.contextPaymentSettings = normalizeRows(await raw`
    SELECT cps.id, cps."organizationId" AS "settingsOrganizationId",
      e."organizationId" AS "eventOrganizationId",
      s."organizationId" AS "storeOrganizationId"
    FROM "ContextPaymentSettings" cps
    LEFT JOIN "Event" e ON e.id = cps."eventId"
    LEFT JOIN "OnlineStore" s ON s.id = cps."onlineStoreId"
    WHERE (e.id IS NOT NULL AND cps."organizationId" <> e."organizationId")
       OR (s.id IS NOT NULL AND cps."organizationId" <> s."organizationId")
      AND cps."organizationId" IN (${Prisma.join(ids)})
    ORDER BY cps."createdAt" DESC
    LIMIT ${SAMPLE_LIMIT}
  `)

  checks.nfcRelations = normalizeRows(await raw`
    SELECT 'NfcCard' AS entity, c.id, c."organizationId", c."eventId", e."organizationId" AS "eventOrganizationId"
    FROM "NfcCard" c
    JOIN "Event" e ON e.id = c."eventId"
    WHERE c."organizationId" <> e."organizationId"
      AND c."organizationId" IN (${Prisma.join(ids)})
    UNION ALL
    SELECT 'NfcCardRead' AS entity, r.id, r."organizationId", r."eventId", e."organizationId" AS "eventOrganizationId"
    FROM "NfcCardRead" r
    JOIN "Event" e ON e.id = r."eventId"
    WHERE r."organizationId" <> e."organizationId"
      AND r."organizationId" IN (${Prisma.join(ids)})
    UNION ALL
    SELECT 'NfcCardTransaction' AS entity, t.id, t."organizationId", t."eventId", e."organizationId" AS "eventOrganizationId"
    FROM "NfcCardTransaction" t
    JOIN "Event" e ON e.id = t."eventId"
    WHERE t."organizationId" <> e."organizationId"
      AND t."organizationId" IN (${Prisma.join(ids)})
    LIMIT ${SAMPLE_LIMIT}
  `)

  return checks
}

async function collectKnownGuellosProducts(pair: TenantPair) {
  const ids = [pair.guellos.id, pair.zeDoFacao.id]
  return normalizeRows(await raw`
    SELECT cp.id, cp.name, cp.slug, cp."organizationId", cp."catalogCategoryId",
      cc.name AS "categoryName", cc."organizationId" AS "categoryOrganizationId",
      cp."createdAt", cp."updatedAt",
      COUNT(DISTINCT ep.id) AS "eventProductCount",
      COUNT(DISTINCT oi.id) AS "orderItemCount",
      COUNT(DISTINCT ooi.id) AS "onlineOrderItemCount",
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT e.slug), NULL) AS "eventSlugs"
    FROM "CatalogProduct" cp
    JOIN "CatalogCategory" cc ON cc.id = cp."catalogCategoryId"
    LEFT JOIN "EventProduct" ep ON ep."catalogProductId" = cp.id
    LEFT JOIN "Event" e ON e.id = ep."eventId"
    LEFT JOIN "OrderItem" oi ON oi."catalogProductId" = cp.id
    LEFT JOIN "OnlineOrderItem" ooi ON ooi."catalogProductId" = cp.id
    WHERE cp."organizationId" IN (${Prisma.join(ids)})
      AND (${Prisma.join(PRODUCT_NAMES.map(name => Prisma.sql`cp.name ILIKE ${`%${name}%`}`), ' OR ')})
    GROUP BY cp.id, cc.id
    ORDER BY cp."organizationId", cp.name
  `)
}

async function collectSlugAmbiguity() {
  return normalizeRows(await raw`
    SELECT slug, COUNT(*) AS total, ARRAY_AGG(json_build_object(
      'id', id,
      'organizationId', "organizationId",
      'name', name
    ) ORDER BY "createdAt") AS events
    FROM "Event"
    GROUP BY slug
    HAVING COUNT(*) > 1
    ORDER BY total DESC, slug
  `)
}

async function collectLikelyGuellosUnderZe(pair: TenantPair) {
  return normalizeRows(await raw`
    SELECT 'OnlineStore' AS entity, s.id, s.name, s.slug, s."organizationId", s."createdAt", s."updatedAt",
      COUNT(DISTINCT oo.id) AS "onlineOrderCount"
    FROM "OnlineStore" s
    LEFT JOIN "OnlineOrder" oo ON oo."storeId" = s.id
    WHERE s."organizationId" = ${pair.zeDoFacao.id}
      AND (s.slug = 'guellos-pizza' OR s.name ILIKE '%guellos%')
    GROUP BY s.id
    UNION ALL
    SELECT 'CatalogProduct' AS entity, cp.id, cp.name, cp.slug, cp."organizationId", cp."createdAt", cp."updatedAt",
      COUNT(DISTINCT ooi.id) AS "onlineOrderCount"
    FROM "CatalogProduct" cp
    LEFT JOIN "OnlineOrderItem" ooi ON ooi."catalogProductId" = cp.id
    WHERE cp."organizationId" = ${pair.zeDoFacao.id}
      AND (${Prisma.join(PRODUCT_NAMES.map(name => Prisma.sql`cp.name ILIKE ${`%${name}%`}`), ' OR ')})
    GROUP BY cp.id
    ORDER BY entity, name
  `)
}

async function main() {
  const pair = await findOrganizations()
  const [counts, crossTenantIssues, knownProducts, duplicateEventSlugs, likelyGuellosUnderZe] =
    await Promise.all([
      collectCounts(pair),
      collectCrossTenantIssues(pair),
      collectKnownGuellosProducts(pair),
      collectSlugAmbiguity(),
      collectLikelyGuellosUnderZe(pair)
    ])

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY_DIAGNOSTIC',
    organizations: pair,
    counts,
    crossTenantIssues,
    knownGuellosProductNameMatches: knownProducts,
    likelyGuellosRecordsUnderZeDoFacao: likelyGuellosUnderZe,
    duplicateEventSlugs,
    notes: [
      'Este script não executa UPDATE, DELETE, INSERT ou migration.',
      'Nomes de produtos são apenas indícios; a propriedade correta deve ser decidida por vínculos, histórico e auditoria.',
      'O script antigo backend/scripts/fix-guellos-tenant.ts contém IDs fixos e não deve ser usado como fonte única de verdade.'
    ]
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
