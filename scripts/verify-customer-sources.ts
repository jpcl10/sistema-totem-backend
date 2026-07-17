import 'dotenv/config'
import {
  CustomerSource,
  PaymentMethod,
  PaymentStatus
} from '@prisma/client'

import { prisma } from '../src/lib/prisma.js'
import { CreateCustomerService } from '../src/modules/customers/services/customer-services.js'
import { GetCustomerService } from '../src/modules/customers/services/customer-services.js'
import { CreateOnlineOrderService } from '../src/modules/online-stores/services/create-online-order-service.js'
import { CreateOrderService } from '../src/modules/orders/services/create-order-service.js'
import { CreateManualSaleService } from '../src/modules/orders/services/create-manual-sale-service.js'

const GUELLOS_ORG_ID = 'cmra0xvea000rvwasonliufxu'
const ZE_ORG_ID = 'cmra0xvdh0000vwas3yfwzxi9'
const STORE_SLUG = 'guellos-pizza'
const TEST_ID = `customer-source-${Date.now()}`

function assertCondition(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function getRequiredSelections(catalogProductId: string) {
  const groups = await prisma.catalogProductOptionGroup.findMany({
    where: {
      productId: catalogProductId,
      active: true
    },
    include: {
      options: {
        where: {
          active: true
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

  return groups
    .filter(group => group.required)
    .map(group => ({
      optionGroupId: group.id,
      optionIds: [group.options[0].id]
    }))
}

async function cleanup(created: {
  customerIds: string[]
  eventIds: string[]
  onlineOrderIds: string[]
  orderIds: string[]
}) {
  const eventOrders = created.eventIds.length > 0
    ? await prisma.order.findMany({
        where: {
          eventId: { in: created.eventIds }
        },
        select: { id: true }
      })
    : []
  const allOrderIds = Array.from(new Set([
    ...created.orderIds,
    ...eventOrders.map(order => order.id)
  ]))
  const customerOnlineOrders = created.customerIds.length > 0
    ? await prisma.onlineOrder.findMany({
        where: {
          customerId: { in: created.customerIds }
        },
        select: { id: true }
      })
    : []
  const allOnlineOrderIds = Array.from(new Set([
    ...created.onlineOrderIds,
    ...customerOnlineOrders.map(order => order.id)
  ]))

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: { in: created.customerIds } },
        { entityId: { in: allOrderIds } },
        { entityId: { in: allOnlineOrderIds } },
        { eventId: { in: created.eventIds } }
      ]
    }
  })

  await prisma.eventPrintJob.deleteMany({
    where: {
      OR: [
        { orderId: { in: allOrderIds } },
        { eventId: { in: created.eventIds } }
      ]
    }
  })
  await prisma.orderItemOption.deleteMany({
    where: {
      orderItem: {
        orderId: { in: allOrderIds }
      }
    }
  })
  await prisma.orderItem.deleteMany({
    where: {
      orderId: { in: allOrderIds }
    }
  })
  await prisma.order.deleteMany({
    where: {
      id: { in: allOrderIds }
    }
  })
  await prisma.onlineOrderItemOption.deleteMany({
    where: {
      onlineOrderItem: {
        orderId: { in: allOnlineOrderIds }
      }
    }
  })
  await prisma.onlineOrderItem.deleteMany({
    where: {
      orderId: { in: allOnlineOrderIds }
    }
  })
  await prisma.onlineOrder.deleteMany({
    where: {
      id: { in: allOnlineOrderIds }
    }
  })
  await prisma.eventProduct.deleteMany({
    where: {
      eventId: { in: created.eventIds }
    }
  })
  await prisma.event.deleteMany({
    where: {
      id: { in: created.eventIds }
    }
  })
  await prisma.customerAddress.deleteMany({
    where: {
      customerId: { in: created.customerIds }
    }
  })
  await prisma.customerInterest.deleteMany({
    where: {
      customerId: { in: created.customerIds }
    }
  })
  await prisma.customer.deleteMany({
    where: {
      id: { in: created.customerIds }
    }
  })
}

async function main() {
  const created = {
    customerIds: [] as string[],
    eventIds: [] as string[],
    onlineOrderIds: [] as string[],
    orderIds: [] as string[]
  }

  try {
    const adminUser = await prisma.user.findFirst({
      where: {
        organizationId: GUELLOS_ORG_ID,
        role: 'ADMIN'
      },
      select: {
        id: true
      }
    })

    assertCondition(adminUser, 'Guellos admin user not found')

    const store = await prisma.onlineStore.findFirst({
      where: {
        slug: STORE_SLUG,
        organizationId: GUELLOS_ORG_ID,
        active: true
      },
      select: {
        id: true
      }
    })

    assertCondition(store, 'Guellos store not found')

    const catalogProduct = await prisma.catalogProduct.findFirst({
      where: {
        organizationId: GUELLOS_ORG_ID,
        active: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    assertCondition(catalogProduct, 'Catalog product not found')

    const selectedOptions = await getRequiredSelections(catalogProduct!.id)

    const createCustomerService = new CreateCustomerService()
    const { customer: adminCustomer } = await createCustomerService.execute({
      organizationId: GUELLOS_ORG_ID,
      userId: adminUser!.id,
      data: {
        name: `Admin ${TEST_ID}`,
        phone: `15988${Date.now().toString().slice(-6)}`
      }
    })
    created.customerIds.push(adminCustomer.id)

    assertCondition(adminCustomer.firstSource === CustomerSource.ADMIN, 'Admin customer firstSource mismatch')
    assertCondition(adminCustomer.lastSource === CustomerSource.ADMIN, 'Admin customer lastSource mismatch')

    const createOnlineOrderService = new CreateOnlineOrderService()
    const onlineResult = await createOnlineOrderService.execute({
      slug: STORE_SLUG,
      customerName: `Online ${TEST_ID}`,
      customerPhone: `15977${Date.now().toString().slice(-6)}`,
      deliveryAddress: 'Rua Teste Customer Source',
      deliveryNumber: '10',
      deliveryNeighborhood: 'Centro',
      paymentMethod: 'PIX',
      deliveryFeeInCents: 0,
      items: [{
        catalogProductId: catalogProduct!.id,
        quantity: 1,
        selectedOptions
      }]
    })
    created.onlineOrderIds.push(onlineResult.order.id)
    created.customerIds.push(onlineResult.order.customerId!)

    const onlineCustomer = await prisma.customer.findUnique({
      where: { id: onlineResult.order.customerId! }
    })

    assertCondition(onlineCustomer?.firstSource === CustomerSource.ONLINE, 'Online customer firstSource mismatch')
    assertCondition(onlineCustomer?.lastSource === CustomerSource.ONLINE, 'Online customer lastSource mismatch')
    assertCondition(
      onlineCustomer?.lastSeenAt.getTime() === onlineResult.order.createdAt.getTime(),
      'Online customer lastSeenAt was not updated from order'
    )

    const event = await prisma.event.create({
      data: {
        organizationId: GUELLOS_ORG_ID,
        name: `Evento ${TEST_ID}`,
        slug: `evento-${TEST_ID}`,
        active: true
      }
    })
    created.eventIds.push(event.id)

    const eventProduct = await prisma.eventProduct.create({
      data: {
        eventId: event.id,
        catalogProductId: catalogProduct!.id,
        active: true,
        trackStock: false,
        soldOut: false,
        priceInCents: 1000
      }
    })

    const createOrderService = new CreateOrderService()
    const eventOrderResult = await createOrderService.execute({
      eventSlug: event.slug,
      customerId: adminCustomer.id,
      customerName: adminCustomer.name,
      paymentStatus: PaymentStatus.PENDING,
      items: [{
        productId: eventProduct.id,
        quantity: 1,
        selectedOptions
      }]
    })
    created.orderIds.push(eventOrderResult.order.id)

    const afterEventCustomer = await prisma.customer.findUnique({
      where: { id: adminCustomer.id }
    })
    assertCondition(afterEventCustomer?.firstSource === CustomerSource.ADMIN, 'firstSource changed after event order')
    assertCondition(afterEventCustomer?.lastSource === CustomerSource.EVENT, 'lastSource not updated to EVENT')
    assertCondition(
      afterEventCustomer?.lastSeenAt.getTime() === eventOrderResult.order.createdAt.getTime(),
      'lastSeenAt not updated from event order'
    )

    const createManualSaleService = new CreateManualSaleService()
    const manualSaleResult = await createManualSaleService.execute({
      organizationId: GUELLOS_ORG_ID,
      userRole: 'ADMIN',
      userId: adminUser!.id,
      eventId: event.id,
      customerId: adminCustomer.id,
      customerName: adminCustomer.name,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PENDING,
      items: [{
        productId: eventProduct.id,
        quantity: 2
      }]
    })
    created.orderIds.push(manualSaleResult.order.id)

    const afterManualCustomer = await prisma.customer.findUnique({
      where: { id: adminCustomer.id }
    })
    assertCondition(afterManualCustomer?.lastSource === CustomerSource.POS, 'lastSource not updated to POS')
    assertCondition(
      afterManualCustomer?.lastSeenAt.getTime() === manualSaleResult.order.createdAt.getTime(),
      'lastSeenAt not updated from manual sale'
    )

    const getCustomerService = new GetCustomerService()
    const { summary } = await getCustomerService.execute({
      organizationId: GUELLOS_ORG_ID,
      customerId: adminCustomer.id
    })

    assertCondition(summary.totalEventOrders === 2, 'summary totalEventOrders mismatch')
    assertCondition(summary.totalOnlineOrders === 0, 'summary totalOnlineOrders mismatch')
    assertCondition(summary.totalOrders === 2, 'summary totalOrders mismatch')
    assertCondition(summary.totalSpentEvents === 3000, 'summary totalSpentEvents mismatch')
    assertCondition(summary.totalSpent === 3000, 'summary totalSpent mismatch')
    assertCondition(summary.averageTicket === 1500, 'summary averageTicket mismatch')
    assertCondition(summary.lastOrderSource === CustomerSource.EVENT, 'summary lastOrderSource mismatch')
    assertCondition(summary.activeTabs === 0, 'summary activeTabs mismatch')
    assertCondition(summary.activeCredentials === 0, 'summary activeCredentials mismatch')

    const zeCannotSee = await prisma.customer.findFirst({
      where: {
        id: adminCustomer.id,
        organizationId: ZE_ORG_ID
      }
    })

    assertCondition(!zeCannotSee, 'multi-tenant isolation failed')

    console.log(JSON.stringify({
      ok: true,
      checks: {
        adminCustomerCreated: true,
        onlineCustomerCreated: true,
        eventOrderUpdatedLastSource: true,
        manualSaleUpdatedLastSource: true,
        lastSeenAtUpdated: true,
        averageTicket: summary.averageTicket,
        multiTenantPreserved: true
      }
    }, null, 2))
  } finally {
    await cleanup(created)
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
