import assert from 'node:assert/strict'

import {
  createDeliveryFeeRuleSchema,
  updateDeliverySettingsSchema,
  updateOnlineOrderSettingsSchema
} from '../src/modules/settings/schemas/settings-schemas.js'
import { createOnlineOrderSchema } from '../src/modules/online-stores/schemas/create-online-order-schema.js'
import { mapOnlineOrderToUnifiedOrder } from '../src/modules/orders/presenters/unified-order-presenter.js'

function assertThrows(fn: () => unknown) {
  let thrown = false

  try {
    fn()
  } catch {
    thrown = true
  }

  assert.equal(thrown, true)
}

const onlineSettings = updateOnlineOrderSettingsSchema.parse({
  onlineOrderingEnabled: true,
  digitalMenuEnabled: true,
  minimumOrderInCents: 2000,
  estimatedPreparationMinutes: 30,
  allowOrdersOutsideHours: false
})

assert.equal(onlineSettings.minimumOrderInCents, 2000)

const deliverySettings = updateDeliverySettingsSchema.parse({
  deliveryEnabled: true,
  pickupEnabled: true,
  defaultDeliveryFeeInCents: 500,
  freeDeliveryAboveInCents: 10000,
  estimatedDeliveryMinutes: 45
})

assert.equal(deliverySettings.defaultDeliveryFeeInCents, 500)

const flatRule = createDeliveryFeeRuleSchema.parse({
  storeId: 'cmra0xvea000rvwasonliufxu',
  name: 'Taxa padrao',
  type: 'FLAT',
  feeInCents: 500
})

assert.equal(flatRule.type, 'FLAT')
assert.equal(flatRule.active, true)
assertThrows(() => createDeliveryFeeRuleSchema.parse({
  storeId: 'cmra0xvea000rvwasonliufxu',
  name: 'Bairro sem nome',
  type: 'NEIGHBORHOOD',
  feeInCents: 700
}))

const deliveryOrderBody = createOnlineOrderSchema.parse({
  customerName: 'Cliente Exemplo',
  customerPhone: '11999990000',
  fulfillment: 'DELIVERY',
  deliveryAddress: 'Rua Exemplo',
  deliveryNumber: '100',
  deliveryNeighborhood: 'Centro',
  paymentMethod: 'CASH',
  deliveryFeeInCents: 99999,
  items: [
    {
      productId: 'product-id',
      quantity: 1
    }
  ]
})

assert.equal(deliveryOrderBody.fulfillment, 'DELIVERY')
assert.equal(deliveryOrderBody.deliveryFeeInCents, 99999)

const pickupOrderBody = createOnlineOrderSchema.parse({
  customerName: 'Cliente Exemplo',
  fulfillment: 'PICKUP',
  paymentMethod: 'PIX',
  items: [
    {
      catalogProductId: 'product-id',
      quantity: 1
    }
  ]
})

assert.equal(pickupOrderBody.fulfillment, 'PICKUP')
assert.equal(pickupOrderBody.deliveryAddress, '')

const unifiedDelivery = mapOnlineOrderToUnifiedOrder({
  id: 'order-1',
  storeId: 'store-1',
  store: {
    id: 'store-1',
    name: 'Loja Exemplo',
    organizationId: 'org-1'
  },
  orderNumber: 1,
  status: 'RECEIVED',
  source: 'DIGITAL_MENU',
  fulfillmentType: 'DELIVERY',
  deliveryRuleId: 'rule-1',
  estimatedMinutes: 45,
  customerName: 'Cliente Exemplo',
  customerPhone: '11999990000',
  deliveryAddress: 'Rua Exemplo',
  deliveryNumber: '100',
  deliveryNeighborhood: 'Centro',
  deliveryComplement: null,
  deliveryReference: null,
  subtotalInCents: 3000,
  deliveryFeeInCents: 500,
  totalInCents: 3500,
  paymentMethod: 'CASH',
  items: [],
  createdAt: new Date('2026-07-13T00:00:00.000Z'),
  updatedAt: new Date('2026-07-13T00:00:00.000Z')
})

assert.equal(unifiedDelivery.fulfillment, 'DELIVERY')
assert.equal(unifiedDelivery.fulfillmentDetails?.type, 'DELIVERY')
assert.equal(unifiedDelivery.fulfillmentDetails?.deliveryFeeInCents, 500)
assert.equal(unifiedDelivery.fulfillmentDetails?.estimatedMinutes, 45)

const unifiedPickup = mapOnlineOrderToUnifiedOrder({
  ...unifiedDelivery,
  id: 'order-2',
  fulfillmentType: 'PICKUP',
  deliveryFeeInCents: 0,
  totalInCents: 3000
})

assert.equal(unifiedPickup.fulfillment, 'PICKUP')
assert.equal(unifiedPickup.fulfillmentDetails?.address, null)

console.log('Settings online/delivery contract checks passed')
