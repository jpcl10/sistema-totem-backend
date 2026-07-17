export const orderNotificationEvents = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_PREPARING: 'ORDER_PREPARING',
  ORDER_READY: 'ORDER_READY',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_CANCELED: 'ORDER_CANCELED'
} as const

export type OrderNotificationEvent =
  (typeof orderNotificationEvents)[keyof typeof orderNotificationEvents]

type OrderNotificationPayload = {
  organizationId: string
  orderId: string
  orderType: 'EVENT_ORDER' | 'ONLINE_ORDER'
  customerId?: string | null
  customerPhone?: string | null
  customerName?: string | null
  orderNumber?: number | null
}

export class OrderNotificationService {
  async publishOrderEvent(
    event: OrderNotificationEvent,
    payload: OrderNotificationPayload
  ) {
    void event
    void payload

    // TODO: enqueue notification for WhatsApp provider integration.
    return {
      queued: false
    }
  }

  async sendOrderConfirmed(payload: OrderNotificationPayload) {
    return this.publishOrderEvent(
      orderNotificationEvents.ORDER_CONFIRMED,
      payload
    )
  }

  async sendPreparing(payload: OrderNotificationPayload) {
    return this.publishOrderEvent(
      orderNotificationEvents.ORDER_PREPARING,
      payload
    )
  }

  async sendReady(payload: OrderNotificationPayload) {
    return this.publishOrderEvent(
      orderNotificationEvents.ORDER_READY,
      payload
    )
  }

  async sendDelivered(payload: OrderNotificationPayload) {
    return this.publishOrderEvent(
      orderNotificationEvents.ORDER_DELIVERED,
      payload
    )
  }

  async sendCanceled(payload: OrderNotificationPayload) {
    return this.publishOrderEvent(
      orderNotificationEvents.ORDER_CANCELED,
      payload
    )
  }
}
