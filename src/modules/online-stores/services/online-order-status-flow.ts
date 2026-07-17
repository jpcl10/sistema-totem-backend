import { OrderSource } from '@prisma/client'

export type OnlineOrderStatusValue =
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

export const onlineOrderStatuses = {
  RECEIVED: 'RECEIVED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
} as const

type OnlineOrderStatusFlowOrder = {
  source: OrderSource | string
  deliveryAddress: string
  deliveryNumber: string
  deliveryNeighborhood: string
}

export function isPickupOnlineOrder(order: OnlineOrderStatusFlowOrder) {
  return (
    order.source === OrderSource.ADMIN &&
    order.deliveryAddress === 'Retirada no balc\u00e3o' &&
    order.deliveryNumber === 'S/N' &&
    order.deliveryNeighborhood === 'Loja'
  )
}

export function getNextOnlineOrderStatuses(order: OnlineOrderStatusFlowOrder & {
  status: OnlineOrderStatusValue
}): OnlineOrderStatusValue[] {
  const isPickup = isPickupOnlineOrder(order)

  switch (order.status) {
    case onlineOrderStatuses.RECEIVED:
      return [onlineOrderStatuses.CONFIRMED, onlineOrderStatuses.CANCELLED]
    case onlineOrderStatuses.CONFIRMED:
      return [onlineOrderStatuses.PREPARING, onlineOrderStatuses.CANCELLED]
    case onlineOrderStatuses.PREPARING:
      return [onlineOrderStatuses.READY, onlineOrderStatuses.CANCELLED]
    case onlineOrderStatuses.READY:
      return isPickup
        ? [onlineOrderStatuses.DELIVERED, onlineOrderStatuses.CANCELLED]
        : [onlineOrderStatuses.OUT_FOR_DELIVERY, onlineOrderStatuses.CANCELLED]
    case onlineOrderStatuses.OUT_FOR_DELIVERY:
      return [onlineOrderStatuses.DELIVERED, onlineOrderStatuses.CANCELLED]
    case onlineOrderStatuses.DELIVERED:
    case onlineOrderStatuses.CANCELLED:
      return []
  }
}

export function canTransitionOnlineOrderStatus(
  order: OnlineOrderStatusFlowOrder & { status: OnlineOrderStatusValue },
  nextStatus: OnlineOrderStatusValue
) {
  return getNextOnlineOrderStatuses(order).includes(nextStatus)
}
