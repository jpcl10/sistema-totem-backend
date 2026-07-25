import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_SLUG = 'guellos-pizza'
const CONFIRM_ARG = `--confirm=${TARGET_SLUG}`

type Mode = 'dry-run' | 'execute'

function parseMode(): Mode {
  const args = process.argv.slice(2)
  if (args.includes('--execute')) return 'execute'
  return 'dry-run'
}

function requireExecuteConfirmation() {
  if (!process.argv.includes(CONFIRM_ARG)) {
    throw new Error(`Refusing to execute without exact confirmation: ${CONFIRM_ARG}`)
  }
}

function maskDatabaseUrl(raw?: string) {
  if (!raw) {
    return {
      databaseHost: null,
      databaseName: null,
      schema: null,
      productionLike: false
    }
  }

  try {
    const url = new URL(raw)
    return {
      databaseHost: url.hostname,
      databaseName: url.pathname.replace(/^\//, '') || null,
      schema: url.searchParams.get('schema') ?? 'public',
      productionLike:
        /prod|production/i.test(url.hostname) ||
        /prod|production/i.test(url.pathname) ||
        process.env.NODE_ENV === 'production'
    }
  } catch {
    return {
      databaseHost: '[unparseable]',
      databaseName: '[unparseable]',
      schema: '[unparseable]',
      productionLike: process.env.NODE_ENV === 'production'
    }
  }
}

function unique<T>(values: T[]) {
  return [...new Set(values.filter(Boolean))]
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function hasAny<T>(values: T[]): values is [T, ...T[]] {
  return values.length > 0
}

function sanitize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value

  const blocked = [
    'accessToken',
    'webhookSecret',
    'password',
    'secret',
    'token',
    'authorization',
    'cookie',
    'credentials'
  ]

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      blocked.some((blockedKey) => key.toLowerCase().includes(blockedKey.toLowerCase()))
        ? '[REDACTED]'
        : sanitize(entry)
    ])
  )
}

async function findOrganization() {
  const exact = await prisma.organization.findMany({
    where: { slug: TARGET_SLUG },
    select: { id: true, name: true, slug: true }
  })

  if (exact.length === 1) return exact[0]

  const similar = await prisma.organization.findMany({
    where: {
      OR: [
        { slug: { contains: 'guellos', mode: 'insensitive' } },
        { name: { contains: 'guellos', mode: 'insensitive' } },
        { name: { contains: 'pizza', mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true, slug: true }
  })

  throw new Error(
    `Expected exactly one organization with slug ${TARGET_SLUG}. Exact matches: ${JSON.stringify(
      exact
    )}. Similar records: ${JSON.stringify(similar)}`
  )
}

async function collectData(organizationId: string) {
  const [events, stores] = await Promise.all([
    prisma.event.findMany({
      where: { organizationId },
      select: { id: true, name: true, slug: true }
    }),
    prisma.onlineStore.findMany({
      where: { organizationId },
      select: { id: true, name: true, slug: true }
    })
  ])

  const eventIds = events.map((event) => event.id)
  const storeIds = stores.map((store) => store.id)

  const [orders, onlineOrders] = await Promise.all([
    hasAny(eventIds)
      ? prisma.order.findMany({
          where: { eventId: { in: eventIds } },
          select: {
            id: true,
            eventId: true,
            customerId: true,
            customerName: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            totalInCents: true,
            amountPaidInCents: true,
            changeForInCents: true,
            paidAt: true,
            paymentNotes: true,
            cancelReason: true,
            cancelledAt: true,
            createdAt: true,
            updatedAt: true,
            items: {
              select: {
                id: true,
                orderId: true,
                productId: true,
                catalogProductId: true,
                quantity: true,
                unitPriceInCents: true,
                totalInCents: true,
                productName: true,
                notes: true,
                pricingSnapshot: true,
                options: true,
                flavors: true
              }
            }
          }
        })
      : [],
    hasAny(storeIds)
      ? prisma.onlineOrder.findMany({
          where: { storeId: { in: storeIds } },
          select: {
            id: true,
            storeId: true,
            orderNumber: true,
            customerId: true,
            customerAddressId: true,
            customerName: true,
            customerPhone: true,
            deliveryAddress: true,
            deliveryNumber: true,
            deliveryNeighborhood: true,
            deliveryComplement: true,
            deliveryReference: true,
            paymentMethod: true,
            paymentStatus: true,
            source: true,
            fulfillmentType: true,
            deliveryRuleId: true,
            estimatedMinutes: true,
            changeForInCents: true,
            subtotalInCents: true,
            deliveryFeeInCents: true,
            totalInCents: true,
            status: true,
            notes: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true,
            items: {
              select: {
                id: true,
                orderId: true,
                productId: true,
                catalogProductId: true,
                productName: true,
                quantity: true,
                unitPriceInCents: true,
                totalInCents: true,
                notes: true,
                pricingSnapshot: true,
                createdAt: true,
                options: true,
                flavors: true
              }
            }
          }
        })
      : []
  ])

  const orderIds = orders.map((order) => order.id)
  const onlineOrderIds = onlineOrders.map((order) => order.id)
  const orderItemIds = orders.flatMap((order) => order.items.map((item) => item.id))
  const onlineOrderItemIds = onlineOrders.flatMap((order) => order.items.map((item) => item.id))

  const [paymentTransactions, eventPrintJobs] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        organizationId,
        OR: [
          hasAny(orderIds) ? { orderId: { in: orderIds } } : undefined,
          hasAny(onlineOrderIds) ? { onlineOrderId: { in: onlineOrderIds } } : undefined
        ].filter(Boolean) as Prisma.PaymentTransactionWhereInput[]
      },
      select: {
        id: true,
        organizationId: true,
        orderId: true,
        onlineOrderId: true,
        terminalId: true,
        deviceId: true,
        contextType: true,
        eventId: true,
        storeId: true,
        provider: true,
        status: true,
        method: true,
        amountInCents: true,
        idempotencyKey: true,
        externalId: true,
        externalReference: true,
        providerTransactionId: true,
        authorizationCode: true,
        nsu: true,
        brand: true,
        installments: true,
        qrCode: true,
        qrCodeBase64: true,
        pixCopyPaste: true,
        gatewayStatus: true,
        gatewayMessage: true,
        approvedAt: true,
        rejectedAt: true,
        cancelledAt: true,
        refundedAt: true,
        expiredAt: true,
        expiresAt: true,
        errorMessage: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        refunds: true
      }
    }),
    prisma.eventPrintJob.findMany({
      where: {
        OR: [
          hasAny(orderIds) ? { orderId: { in: orderIds } } : undefined,
          hasAny(onlineOrderIds) ? { onlineOrderId: { in: onlineOrderIds } } : undefined
        ].filter(Boolean) as Prisma.EventPrintJobWhereInput[]
      }
    })
  ])

  const paymentTransactionIds = paymentTransactions.map((transaction) => transaction.id)
  const paymentExternalIds = uniqueStrings(
    paymentTransactions.flatMap((transaction) => [
      transaction.externalId,
      transaction.providerTransactionId
    ])
  )
  const paymentRefunds = paymentTransactions.flatMap((transaction) => transaction.refunds)

  const [paymentWebhookEvents, auditLogs] = await Promise.all([
    hasAny(paymentExternalIds)
      ? prisma.paymentWebhookEvent.findMany({
          where: {
            organizationId,
            externalPaymentId: { in: paymentExternalIds }
          }
        })
      : [],
    prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [
          hasAny(orderIds) ? { entityId: { in: orderIds } } : undefined,
          hasAny(onlineOrderIds) ? { entityId: { in: onlineOrderIds } } : undefined,
          hasAny(paymentTransactionIds)
            ? { entityId: { in: paymentTransactionIds } }
            : undefined
        ].filter(Boolean) as Prisma.AuditLogWhereInput[]
      }
    })
  ])

  return {
    events,
    stores,
    orders,
    onlineOrders,
    orderIds,
    onlineOrderIds,
    orderItemIds,
    onlineOrderItemIds,
    paymentTransactions,
    paymentTransactionIds,
    paymentExternalIds,
    paymentRefunds,
    paymentWebhookEvents,
    eventPrintJobs,
    auditLogs
  }
}

function buildAudit(data: Awaited<ReturnType<typeof collectData>>) {
  const allOrders = [...data.orders, ...data.onlineOrders]
  const createdDates = allOrders.map((order) => order.createdAt).sort((a, b) => a.getTime() - b.getTime())

  return {
    counts: {
      Order: data.orders.length,
      OnlineOrder: data.onlineOrders.length,
      OrderItem: data.orderItemIds.length,
      OnlineOrderItem: data.onlineOrderItemIds.length,
      OrderItemOption: data.orders.flatMap((order) => order.items.flatMap((item) => item.options)).length,
      OnlineOrderItemOption: data.onlineOrders.flatMap((order) => order.items.flatMap((item) => item.options)).length,
      OrderItemFlavor: data.orders.flatMap((order) => order.items.flatMap((item) => item.flavors)).length,
      OnlineOrderItemFlavor: data.onlineOrders.flatMap((order) => order.items.flatMap((item) => item.flavors)).length,
      PaymentTransaction: data.paymentTransactions.length,
      PaymentRefund: data.paymentRefunds.length,
      EventPrintJob: data.eventPrintJobs.length,
      PaymentWebhookEvent: data.paymentWebhookEvents.length,
      AuditLogRelated: data.auditLogs.length
    },
    firstOrderAt: createdDates[0]?.toISOString() ?? null,
    lastOrderAt: createdDates.length > 0
      ? createdDates[createdDates.length - 1].toISOString()
      : null,
    totalInCents:
      data.orders.reduce((sum, order) => sum + order.totalInCents, 0) +
      data.onlineOrders.reduce((sum, order) => sum + order.totalInCents, 0),
    orderStatuses: unique(data.orders.map((order) => order.status)),
    onlineOrderStatuses: unique(data.onlineOrders.map((order) => order.status)),
    paymentStatuses: unique(allOrders.map((order) => order.paymentStatus)),
    sources: unique(allOrders.map((order) => 'source' in order ? order.source : 'EVENT')),
    eventOrderNumbers: data.orders.map((order) => order.orderNumber).sort((a, b) => a - b),
    onlineOrderNumbers: data.onlineOrders.map((order) => order.orderNumber).sort((a, b) => a - b)
  }
}

function backupPath() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 13)
  return path.join('backups', `guellos-orders-before-production-${stamp}.json`)
}

async function writeBackup(
  organization: { id: string; name: string; slug: string },
  data: Awaited<ReturnType<typeof collectData>>,
  audit: ReturnType<typeof buildAudit>
) {
  const relativePath = backupPath()
  const absolutePath = path.join(process.cwd(), relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(
    absolutePath,
    JSON.stringify(
      sanitize({
        exportedAt: new Date().toISOString(),
        organization,
        audit,
        data
      }),
      null,
      2
    ),
    'utf8'
  )
  return { relativePath, absolutePath }
}

async function deleteInTransaction(
  organization: { id: string; name: string; slug: string },
  data: Awaited<ReturnType<typeof collectData>>,
  backupRelativePath: string
) {
  const deleted = await prisma.$transaction(async (tx) => {
    const result: Record<string, number> = {}

    if (hasAny(data.paymentWebhookEvents.map((event) => event.id))) {
      result.PaymentWebhookEvent = (
        await tx.paymentWebhookEvent.deleteMany({
          where: { id: { in: data.paymentWebhookEvents.map((event) => event.id) }, organizationId: organization.id }
        })
      ).count
    }

    if (hasAny(data.auditLogs.map((log) => log.id))) {
      result.AuditLogRelated = (
        await tx.auditLog.deleteMany({
          where: { id: { in: data.auditLogs.map((log) => log.id) }, organizationId: organization.id }
        })
      ).count
    }

    if (hasAny(data.paymentTransactionIds)) {
      result.PaymentRefund = (
        await tx.paymentRefund.deleteMany({
          where: { organizationId: organization.id, paymentTransactionId: { in: data.paymentTransactionIds } }
        })
      ).count
    }

    if (hasAny(data.eventPrintJobs.map((job) => job.id))) {
      result.EventPrintJob = (
        await tx.eventPrintJob.deleteMany({
          where: { id: { in: data.eventPrintJobs.map((job) => job.id) } }
        })
      ).count
    }

    if (hasAny(data.paymentTransactionIds)) {
      result.PaymentTransaction = (
        await tx.paymentTransaction.deleteMany({
          where: { id: { in: data.paymentTransactionIds }, organizationId: organization.id }
        })
      ).count
    }

    if (hasAny(data.orderItemIds)) {
      result.OrderItemOption = (
        await tx.orderItemOption.deleteMany({
          where: { orderItemId: { in: data.orderItemIds } }
        })
      ).count
      result.OrderItemFlavor = (
        await tx.orderItemFlavor.deleteMany({
          where: { orderItemId: { in: data.orderItemIds } }
        })
      ).count
    }

    if (hasAny(data.onlineOrderItemIds)) {
      result.OnlineOrderItemOption = (
        await tx.onlineOrderItemOption.deleteMany({
          where: { onlineOrderItemId: { in: data.onlineOrderItemIds } }
        })
      ).count
      result.OnlineOrderItemFlavor = (
        await tx.onlineOrderItemFlavor.deleteMany({
          where: { onlineOrderItemId: { in: data.onlineOrderItemIds } }
        })
      ).count
    }

    if (hasAny(data.orderIds)) {
      result.OrderItem = (
        await tx.orderItem.deleteMany({
          where: { orderId: { in: data.orderIds } }
        })
      ).count
      result.Order = (
        await tx.order.deleteMany({
          where: { id: { in: data.orderIds }, eventId: { in: data.events.map((event) => event.id) } }
        })
      ).count
    }

    if (hasAny(data.onlineOrderIds)) {
      result.OnlineOrderItem = (
        await tx.onlineOrderItem.deleteMany({
          where: { orderId: { in: data.onlineOrderIds } }
        })
      ).count
      result.OnlineOrder = (
        await tx.onlineOrder.deleteMany({
          where: { id: { in: data.onlineOrderIds }, storeId: { in: data.stores.map((store) => store.id) } }
        })
      ).count
    }

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        entity: 'Organization',
        entityId: organization.id,
        action: 'ORDER_UPDATED',
        description: 'TEST_ORDERS_CLEANUP: pedidos de teste removidos para inicio da operacao real',
        metadata: {
          cleanupAction: 'TEST_ORDERS_CLEANUP',
          reason: 'inicio da operacao real',
          backupFile: backupRelativePath,
          removed: result,
          executor: process.env.USERNAME ?? process.env.USER ?? 'script'
        }
      }
    })

    result.AuditLogCleanup = 1
    return result
  })

  return deleted
}

async function preservedCounts(organizationId: string) {
  const [
    organizations,
    users,
    customers,
    customerAddresses,
    catalogCategories,
    catalogProducts,
    onlineStores,
    events,
    devices,
    printers,
    providerCredentials,
    paymentSettings,
    contextPaymentSettings,
    businessHours,
    modules
  ] = await Promise.all([
    prisma.organization.count({ where: { id: organizationId } }),
    prisma.user.count({ where: { organizationId } }),
    prisma.customer.count({ where: { organizationId } }),
    prisma.customerAddress.count({ where: { organizationId } }),
    prisma.catalogCategory.count({ where: { organizationId } }),
    prisma.catalogProduct.count({ where: { organizationId } }),
    prisma.onlineStore.count({ where: { organizationId } }),
    prisma.event.count({ where: { organizationId } }),
    prisma.device.count({ where: { organizationId } }),
    prisma.eventPrinter.count({ where: { event: { organizationId } } }),
    prisma.paymentProviderCredential.count({ where: { organizationId } }),
    prisma.organizationPaymentSettings.count({ where: { organizationId } }),
    prisma.contextPaymentSettings.count({ where: { organizationId } }),
    prisma.businessHour.count({ where: { organizationId } }),
    prisma.organizationModule.count({ where: { organizationId } })
  ])

  return {
    Organization: organizations,
    User: users,
    Customer: customers,
    CustomerAddress: customerAddresses,
    CatalogCategory: catalogCategories,
    CatalogProduct: catalogProducts,
    OnlineStore: onlineStores,
    Event: events,
    Device: devices,
    EventPrinter: printers,
    PaymentProviderCredential: providerCredentials,
    OrganizationPaymentSettings: paymentSettings,
    ContextPaymentSettings: contextPaymentSettings,
    BusinessHour: businessHours,
    OrganizationModule: modules
  }
}

async function main() {
  const mode = parseMode()
  if (mode === 'execute') requireExecuteConfirmation()

  const db = maskDatabaseUrl(process.env.DATABASE_URL)
  const organization = await findOrganization()
  const data = await collectData(organization.id)
  const audit = buildAudit(data)
  const plannedBackup = backupPath()

  console.log(JSON.stringify({
    mode,
    environment: {
      NODE_ENV: process.env.NODE_ENV ?? null,
      databaseHost: db.databaseHost,
      databaseName: db.databaseName,
      schema: db.schema,
      productionWarning: db.productionLike ? 'ATENCAO: BANCO DE PRODUCAO' : null
    },
    organization: {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug
    },
    audit,
    plannedBackup: mode === 'dry-run' ? plannedBackup : undefined,
    preservedBefore: await preservedCounts(organization.id),
    numbering: {
      orderNumber: 'Order.orderNumber is unique per eventId',
      onlineOrderNumber: 'OnlineOrder.orderNumber is unique per storeId',
      displayNumber: 'not present in schema.prisma',
      dailySequence: 'not present in schema.prisma',
      resetPerformed: false
    }
  }, null, 2))

  if (mode === 'dry-run') return

  const backup = await writeBackup(organization, data, audit)
  const deleted = await deleteInTransaction(organization, data, backup.relativePath)
  const afterData = await collectData(organization.id)

  console.log(JSON.stringify({
    executed: true,
    backup,
    deleted,
    afterAudit: buildAudit(afterData),
    preservedAfter: await preservedCounts(organization.id)
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
