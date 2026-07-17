import 'dotenv/config'
import { Prisma, PrismaClient } from '@prisma/client'

import { normalizePhone } from '../src/modules/customers/utils/customer-normalization.js'

const prisma = new PrismaClient()

const GUELLOS_ORG_ID = 'cmra0xvea000rvwasonliufxu'
const ZE_ORG_ID = 'cmra0xvdh0000vwas3yfwzxi9'
const STORE_SLUG = 'guellos-pizza'
const DRY_RUN = process.env.DRY_RUN !== 'false'

type Tx = Prisma.TransactionClient

class DryRunRollback extends Error {
  constructor(public readonly report: unknown) {
    super('DRY_RUN_ROLLBACK')
  }
}

async function execute(tx: Tx) {
  const store = await tx.onlineStore.findFirst({
    where: {
      slug: STORE_SLUG,
      organizationId: GUELLOS_ORG_ID
    },
    select: {
      id: true,
      slug: true,
      organizationId: true
    }
  })

  if (!store) {
    throw new Error('Guellos store not found in Guellos organization')
  }

  const orders = await tx.onlineOrder.findMany({
    where: {
      storeId: store.id
    },
    include: {
      customer: true,
      customerAddress: true
    },
    orderBy: {
      orderNumber: 'asc'
    }
  })

  const report = {
    dryRun: DRY_RUN,
    store,
    ordersFound: orders.length,
    ordersCorrected: [] as unknown[],
    customersCreated: [] as unknown[],
    customersReused: [] as unknown[],
    addressesCreated: [] as unknown[],
    addressesReused: [] as unknown[],
    zeOrphanCustomersRemaining: [] as unknown[]
  }

  for (const order of orders) {
    const normalizedPhone = normalizePhone(order.customerPhone)

    if (!normalizedPhone) {
      report.ordersCorrected.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        skipped: true,
        reason: 'missing phone'
      })
      continue
    }

    let customer = await tx.customer.findFirst({
      where: {
        organizationId: GUELLOS_ORG_ID,
        normalizedPhone
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        phone: true,
        normalizedPhone: true
      }
    })

    if (customer) {
      report.customersReused.push({
        id: customer.id,
        normalizedPhone,
        orderId: order.id
      })
    } else {
      customer = await tx.customer.create({
        data: {
          organizationId: GUELLOS_ORG_ID,
          name: order.customerName,
          phone: order.customerPhone,
          normalizedPhone,
          active: true
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
          phone: true,
          normalizedPhone: true
        }
      })

      report.customersCreated.push({
        id: customer.id,
        normalizedPhone,
        orderId: order.id
      })
    }

    let address = await tx.customerAddress.findFirst({
      where: {
        organizationId: GUELLOS_ORG_ID,
        customerId: customer.id,
        street: order.deliveryAddress,
        number: order.deliveryNumber,
        neighborhood: order.deliveryNeighborhood
      },
      select: {
        id: true,
        customerId: true,
        organizationId: true
      }
    })

    if (address) {
      report.addressesReused.push({
        id: address.id,
        customerId: customer.id,
        orderId: order.id
      })
    } else {
      address = await tx.customerAddress.create({
        data: {
          organizationId: GUELLOS_ORG_ID,
          customerId: customer.id,
          street: order.deliveryAddress,
          number: order.deliveryNumber,
          neighborhood: order.deliveryNeighborhood,
          complement: order.deliveryComplement,
          reference: order.deliveryReference,
          active: true,
          isDefault: false
        },
        select: {
          id: true,
          customerId: true,
          organizationId: true
        }
      })

      report.addressesCreated.push({
        id: address.id,
        customerId: customer.id,
        orderId: order.id
      })
    }

    if (!DRY_RUN) {
      await tx.onlineOrder.update({
        where: {
          id: order.id
        },
        data: {
          customerId: customer.id,
          customerAddressId: address.id
        }
      })
    }

    report.ordersCorrected.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      previousCustomerId: order.customerId,
      previousCustomerOrganizationId: order.customer?.organizationId ?? null,
      newCustomerId: customer.id,
      newCustomerOrganizationId: customer.organizationId,
      previousCustomerAddressId: order.customerAddressId,
      newCustomerAddressId: address.id,
      snapshotsPreserved: {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryNumber: order.deliveryNumber,
        deliveryNeighborhood: order.deliveryNeighborhood
      }
    })
  }

  const zeCustomers = await tx.customer.findMany({
    where: {
      organizationId: ZE_ORG_ID
    },
    select: {
      id: true,
      name: true,
      phone: true,
      normalizedPhone: true,
      _count: {
        select: {
          onlineOrders: true,
          addresses: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  report.zeOrphanCustomersRemaining = zeCustomers
    .filter(customer => customer._count.onlineOrders === 0)
    .map(customer => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      normalizedPhone: customer.normalizedPhone,
      addressesCount: customer._count.addresses
    }))

  if (DRY_RUN) {
    throw new DryRunRollback(report)
  }

  return report
}

async function main() {
  try {
    const report = await prisma.$transaction(async tx => execute(tx))
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    if (error instanceof DryRunRollback) {
      console.log(JSON.stringify(error.report, null, 2))
      return
    }

    throw error
  }
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
