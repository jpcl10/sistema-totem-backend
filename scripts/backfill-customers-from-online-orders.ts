import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

import { normalizePhone } from '../src/modules/customers/utils/customer-normalization.js'

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN !== 'false'

async function main() {
  if (!DRY_RUN) {
    throw new Error('Real backfill is not implemented in this phase. Run with DRY_RUN=true.')
  }

  const orders = await prisma.onlineOrder.findMany({
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
      store: {
        select: {
          organizationId: true,
          slug: true,
          organization: {
            select: {
              name: true
            }
          }
        }
      }
    }
  })

  const byOrganization = new Map<string, {
    organizationId: string
    organizationName: string
    totalOnlineOrders: number
    ordersWithPhone: number
    ordersWithoutCustomerId: number
    uniquePhones: Map<string, { names: Set<string>; orderIds: string[] }>
  }>()

  for (const order of orders) {
    const organizationId = order.store.organizationId
    const entry = byOrganization.get(organizationId) ?? {
      organizationId,
      organizationName: order.store.organization.name,
      totalOnlineOrders: 0,
      ordersWithPhone: 0,
      ordersWithoutCustomerId: 0,
      uniquePhones: new Map()
    }

    entry.totalOnlineOrders++

    if (!order.customerId) {
      entry.ordersWithoutCustomerId++
    }

    const normalizedPhone = normalizePhone(order.customerPhone)

    if (normalizedPhone) {
      entry.ordersWithPhone++
      const phoneEntry = entry.uniquePhones.get(normalizedPhone) ?? {
        names: new Set<string>(),
        orderIds: []
      }

      phoneEntry.names.add(order.customerName)
      phoneEntry.orderIds.push(order.id)
      entry.uniquePhones.set(normalizedPhone, phoneEntry)
    }

    byOrganization.set(organizationId, entry)
  }

  const report = Array.from(byOrganization.values()).map(entry => ({
    organizationId: entry.organizationId,
    organizationName: entry.organizationName,
    totalOnlineOrders: entry.totalOnlineOrders,
    ordersWithPhone: entry.ordersWithPhone,
    ordersWithoutCustomerId: entry.ordersWithoutCustomerId,
    uniquePhones: entry.uniquePhones.size,
    ambiguities: Array.from(entry.uniquePhones.entries())
      .filter(([, value]) => value.names.size > 1)
      .map(([normalizedPhone, value]) => ({
        normalizedPhone,
        names: Array.from(value.names),
        orderIds: value.orderIds
      }))
  }))

  console.log(JSON.stringify({ dryRun: true, report }, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
