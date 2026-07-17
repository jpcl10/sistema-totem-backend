import assert from 'node:assert/strict'
import { OnlineOrderStatus, OrderSource } from '@prisma/client'

import {
  canTransitionOnlineOrderStatus,
  getNextOnlineOrderStatuses
} from '../src/modules/online-stores/services/online-order-status-flow.js'
import { mapOnlineOrderToUnifiedOrder } from '../src/modules/orders/presenters/unified-order-presenter.js'

const deliveryOrder = {
  source: OrderSource.DIGITAL_MENU,
  deliveryAddress: 'Rua Exemplo',
  deliveryNumber: '123',
  deliveryNeighborhood: 'Centro'
}

const pickupOrder = {
  source: OrderSource.ADMIN,
  deliveryAddress: 'Retirada no balc\u00e3o',
  deliveryNumber: 'S/N',
  deliveryNeighborhood: 'Loja'
}

assert.equal(canTransitionOnlineOrderStatus({
  ...deliveryOrder,
  status: OnlineOrderStatus.RECEIVED
}, OnlineOrderStatus.CONFIRMED), true)

assert.equal(canTransitionOnlineOrderStatus({
  ...deliveryOrder,
  status: OnlineOrderStatus.CONFIRMED
}, OnlineOrderStatus.PREPARING), true)

assert.equal(canTransitionOnlineOrderStatus({
  ...deliveryOrder,
  status: OnlineOrderStatus.PREPARING
}, OnlineOrderStatus.READY), true)

assert.equal(canTransitionOnlineOrderStatus({
  ...deliveryOrder,
  status: OnlineOrderStatus.READY
}, OnlineOrderStatus.OUT_FOR_DELIVERY), true)

assert.equal(canTransitionOnlineOrderStatus({
  ...pickupOrder,
  status: OnlineOrderStatus.READY
}, OnlineOrderStatus.DELIVERED), true)

assert.equal(canTransitionOnlineOrderStatus({
  ...deliveryOrder,
  status: OnlineOrderStatus.OUT_FOR_DELIVERY
}, OnlineOrderStatus.DELIVERED), true)

assert.equal(canTransitionOnlineOrderStatus({
  ...deliveryOrder,
  status: OnlineOrderStatus.PREPARING
}, OnlineOrderStatus.OUT_FOR_DELIVERY), false)

assert.deepEqual(getNextOnlineOrderStatuses({
  ...pickupOrder,
  status: OnlineOrderStatus.READY
}), [
  OnlineOrderStatus.DELIVERED,
  OnlineOrderStatus.CANCELLED
])

const unifiedOrder = mapOnlineOrderToUnifiedOrder({
  id: 'online-order-test',
  storeId: 'store-test',
  store: {
    id: 'store-test',
    name: 'Loja Teste',
    organizationId: 'org-test'
  },
  orderNumber: 10,
  status: OnlineOrderStatus.READY,
  source: OrderSource.ADMIN,
  customerId: null,
  customerName: 'Cliente Teste',
  customerPhone: '',
  deliveryAddress: 'Retirada no balc\u00e3o',
  deliveryNumber: 'S/N',
  deliveryNeighborhood: 'Loja',
  deliveryComplement: null,
  deliveryReference: null,
  subtotalInCents: 3000,
  deliveryFeeInCents: 0,
  totalInCents: 3000,
  paymentMethod: 'CASH',
  items: [],
  createdAt: new Date('2026-07-13T00:00:00.000Z'),
  updatedAt: new Date('2026-07-13T00:00:00.000Z')
})

assert.equal(unifiedOrder.status, 'READY')
assert.equal(unifiedOrder.rawStatus, OnlineOrderStatus.READY)
assert.equal(unifiedOrder.fulfillment, 'PICKUP')

console.log('OnlineOrder status flow checks passed')
