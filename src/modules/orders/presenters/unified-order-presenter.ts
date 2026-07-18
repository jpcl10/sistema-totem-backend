export type UnifiedOrderOrigin =
  | 'ONLINE'
  | 'TOTEM'
  | 'EVENT'
  | 'POS'
  | 'COMANDA'
  | 'QR_MESA'
  | 'GARCOM_MOBILE'
  | 'API'
  | 'WHATSAPP'

export type UnifiedOrderStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'

export type UnifiedOrderDTO = {
  id: string
  nativeId: string
  orderType: 'EVENT_ORDER' | 'ONLINE_ORDER'
  sourceType: 'EVENT' | 'ONLINE'
  origin: UnifiedOrderOrigin
  originLabel: string
  originIcon: string
  channel: string | null
  organizationId: string
  eventId: string | null
  eventName: string | null
  storeId: string | null
  storeName: string | null
  orderNumber: number
  status: UnifiedOrderStatus
  rawStatus: string
  fulfillment: 'ON_SITE' | 'DELIVERY' | 'PICKUP' | 'UNKNOWN'
  fulfillmentDetails?: {
    type: 'ON_SITE' | 'DELIVERY' | 'PICKUP' | 'COUNTER' | 'DINE_IN' | 'UNKNOWN'
    address: {
      address: string | null
      number: string | null
      neighborhood: string | null
      complement: string | null
      reference: string | null
    } | null
    deliveryFeeInCents: number | null
    estimatedMinutes: number | null
    deliveryRuleId: string | null
  }
  customer: {
    id: string | null
    name: string | null
    phone: string | null
  }
  delivery: {
    address: string | null
    number: string | null
    neighborhood: string | null
    complement: string | null
    reference: string | null
  } | null
  totals: {
    subtotalInCents: number | null
    deliveryFeeInCents: number | null
    totalInCents: number
  }
  payment: {
    status: string | null
    method: string | null
    paidAt: Date | null
    transactionCount: number
  }
  items: {
    id: string
    catalogProductId: string | null
    productName: string
    quantity: number
    unitPriceInCents: number
    totalInCents: number
    notes: string | null
    options: {
      groupName: string
      optionName: string
      priceDeltaInCents: number
    }[]
    flavors?: {
      flavorName: string
      priceInCents: number
      position: number
    }[]
  }[]
  printing: {
    enabled: boolean
    jobsCount: number
    pendingCount: number
    errorCount: number
  }
  actionEndpoints: {
    status: string
    payment: string | null
  }
  createdAt: Date
  updatedAt: Date
}

type UnifiedOriginMeta = {
  label: string
  icon: string
}

const originMeta: Record<UnifiedOrderOrigin, UnifiedOriginMeta> = {
  ONLINE: { label: 'Online', icon: 'shopping-bag' },
  TOTEM: { label: 'Totem', icon: 'monitor-smartphone' },
  EVENT: { label: 'Evento', icon: 'calendar-days' },
  POS: { label: 'Caixa', icon: 'badge-dollar-sign' },
  COMANDA: { label: 'Comanda', icon: 'receipt-text' },
  QR_MESA: { label: 'QR Mesa', icon: 'qr-code' },
  GARCOM_MOBILE: { label: 'Garcom Mobile', icon: 'smartphone' },
  API: { label: 'API', icon: 'braces' },
  WHATSAPP: { label: 'WhatsApp', icon: 'message-circle' }
}

function mapEventStatus(status: string): UnifiedOrderStatus {
  switch (status) {
    case 'CONFIRMED':
      return 'CONFIRMED'
    case 'PREPARING':
      return 'PREPARING'
    case 'READY':
      return 'READY'
    case 'DELIVERED':
      return 'COMPLETED'
    case 'CANCELLED':
      return 'CANCELLED'
    default:
      return 'CONFIRMED'
  }
}

function mapOnlineStatus(status: string): UnifiedOrderStatus {
  switch (status) {
    case 'RECEIVED':
      return 'NEW'
    case 'CONFIRMED':
      return 'CONFIRMED'
    case 'PREPARING':
      return 'PREPARING'
    case 'READY':
      return 'READY'
    case 'OUT_FOR_DELIVERY':
      return 'OUT_FOR_DELIVERY'
    case 'DELIVERED':
      return 'COMPLETED'
    case 'CANCELLED':
      return 'CANCELLED'
    default:
      return 'NEW'
  }
}

function getOnlineFulfillment(order: any): 'DELIVERY' | 'PICKUP' {
  if (order.fulfillmentType === 'PICKUP') {
    return 'PICKUP'
  }

  if (order.fulfillmentType === 'DELIVERY') {
    return 'DELIVERY'
  }

  if (
    order.source === 'ADMIN' &&
    order.deliveryAddress === 'Retirada no balc\u00e3o' &&
    order.deliveryNumber === 'S/N' &&
    order.deliveryNeighborhood === 'Loja'
  ) {
    return 'PICKUP'
  }

  return 'DELIVERY'
}

function getEventOrigin(order: any): UnifiedOrderOrigin {
  if (order.device?.type === 'TOTEM') {
    return 'TOTEM'
  }

  if (order.paymentNotes === 'Venda manual criada pelo painel') {
    return 'POS'
  }

  return 'EVENT'
}

function getOriginMeta(origin: UnifiedOrderOrigin) {
  return originMeta[origin]
}

function mapItemOptions(options: any[] | undefined) {
  return (options ?? []).map(option => ({
    groupName: option.groupName,
    optionName: option.optionName,
    priceDeltaInCents: option.priceDeltaInCents
  }))
}

function mapItemFlavors(flavors: any[] | undefined) {
  return (flavors ?? [])
    .slice()
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map(flavor => ({
      flavorName: flavor.flavorName,
      priceInCents: flavor.priceInCents,
      position: flavor.position
    }))
}

function countPaymentTransactions(paymentTransactions: unknown) {
  if (Array.isArray(paymentTransactions)) {
    return paymentTransactions.length
  }

  if (
    typeof paymentTransactions === 'object' &&
    paymentTransactions !== null &&
    '_count' in paymentTransactions
  ) {
    const count = (paymentTransactions as { _count?: unknown })._count

    return typeof count === 'number' ? count : 0
  }

  return 0
}

export function mapEventOrderToUnifiedOrder(order: any): UnifiedOrderDTO {
  const origin = getEventOrigin(order)
  const meta = getOriginMeta(origin)
  const printJobs = order.printJobs ?? []

  return {
    id: order.id,
    nativeId: order.id,
    orderType: 'EVENT_ORDER',
    sourceType: 'EVENT',
    origin,
    originLabel: meta.label,
    originIcon: meta.icon,
    channel: origin,
    organizationId: order.event?.organizationId ?? order.organizationId ?? '',
    eventId: order.eventId ?? order.event?.id ?? null,
    eventName: order.event?.name ?? null,
    storeId: null,
    storeName: null,
    orderNumber: order.orderNumber,
    status: mapEventStatus(order.status),
    rawStatus: order.status,
    fulfillment: 'ON_SITE',
    fulfillmentDetails: {
      type: 'ON_SITE',
      address: null,
      deliveryFeeInCents: null,
      estimatedMinutes: null,
      deliveryRuleId: null
    },
    customer: {
      id: order.customerId ?? null,
      name: order.customer?.name ?? order.customerName ?? null,
      phone: order.customer?.phone ?? null
    },
    delivery: null,
    totals: {
      subtotalInCents: null,
      deliveryFeeInCents: null,
      totalInCents: order.totalInCents
    },
    payment: {
      status: order.paymentStatus ?? null,
      method: order.paymentMethod ?? null,
      paidAt: order.paidAt ?? null,
      transactionCount: countPaymentTransactions(order.paymentTransactions)
    },
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      catalogProductId: item.catalogProductId ?? null,
      productName: item.productName,
      quantity: item.quantity,
      unitPriceInCents: item.unitPriceInCents,
      totalInCents: item.totalInCents,
      notes: null,
      options: mapItemOptions(item.options),
      flavors: mapItemFlavors(item.flavors)
    })),
    printing: {
      enabled: Boolean(order.event?.printingEnabled),
      jobsCount: printJobs.length,
      pendingCount: printJobs.filter((job: any) => job.status === 'PENDING').length,
      errorCount: printJobs.filter((job: any) => job.status === 'ERROR').length
    },
    actionEndpoints: {
      status: `/orders/${order.id}/status`,
      payment: `/orders/unified/EVENT_ORDER/${order.id}/payment`
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }
}

export function mapOnlineOrderToUnifiedOrder(order: any): UnifiedOrderDTO {
  const origin: UnifiedOrderOrigin = 'ONLINE'
  const meta = getOriginMeta(origin)
  const fulfillment = getOnlineFulfillment(order)
  const printJobs = order.printJobs ?? []

  return {
    id: order.id,
    nativeId: order.id,
    orderType: 'ONLINE_ORDER',
    sourceType: 'ONLINE',
    origin,
    originLabel: meta.label,
    originIcon: meta.icon,
    channel: order.source ?? 'DIGITAL_MENU',
    organizationId: order.store?.organizationId ?? order.organizationId ?? '',
    eventId: null,
    eventName: null,
    storeId: order.storeId ?? order.store?.id ?? null,
    storeName: order.store?.name ?? null,
    orderNumber: order.orderNumber,
    status: mapOnlineStatus(order.status),
    rawStatus: order.status,
    fulfillment,
    fulfillmentDetails: {
      type: order.fulfillmentType ?? fulfillment,
      address: fulfillment === 'DELIVERY'
        ? {
            address: order.deliveryAddress,
            number: order.deliveryNumber,
            neighborhood: order.deliveryNeighborhood,
            complement: order.deliveryComplement ?? null,
            reference: order.deliveryReference ?? null
          }
        : null,
      deliveryFeeInCents: order.deliveryFeeInCents ?? null,
      estimatedMinutes: order.estimatedMinutes ?? null,
      deliveryRuleId: order.deliveryRuleId ?? null
    },
    customer: {
      id: order.customerId ?? null,
      name: order.customer?.name ?? order.customerName ?? null,
      phone: order.customer?.phone ?? order.customerPhone ?? null
    },
    delivery: {
      address: order.deliveryAddress,
      number: order.deliveryNumber,
      neighborhood: order.deliveryNeighborhood,
      complement: order.deliveryComplement ?? null,
      reference: order.deliveryReference ?? null
    },
    totals: {
      subtotalInCents: order.subtotalInCents,
      deliveryFeeInCents: order.deliveryFeeInCents,
      totalInCents: order.totalInCents
    },
    payment: {
      status: order.paymentStatus ?? 'NOT_TRACKED',
      method: order.paymentMethod,
      paidAt: order.paidAt ?? null,
      transactionCount: 0
    },
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      catalogProductId: item.catalogProductId ?? null,
      productName: item.productName,
      quantity: item.quantity,
      unitPriceInCents: item.unitPriceInCents,
      totalInCents: item.totalInCents,
      notes: item.notes ?? null,
      options: mapItemOptions(item.options),
      flavors: mapItemFlavors(item.flavors)
    })),
    printing: {
      enabled: Boolean(order.store?.printingEnabled),
      jobsCount: printJobs.length,
      pendingCount: printJobs.filter((job: any) => job.status === 'PENDING').length,
      errorCount: printJobs.filter((job: any) => job.status === 'ERROR').length
    },
    actionEndpoints: {
      status: `/online-orders/${order.id}/status`,
      payment: `/orders/unified/ONLINE_ORDER/${order.id}/payment`
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }
}
