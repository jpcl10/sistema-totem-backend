export const orderNotificationEvents = {
    ORDER_CREATED: 'ORDER_CREATED',
    ORDER_CONFIRMED: 'ORDER_CONFIRMED',
    ORDER_PREPARING: 'ORDER_PREPARING',
    ORDER_READY: 'ORDER_READY',
    ORDER_DELIVERED: 'ORDER_DELIVERED',
    ORDER_CANCELED: 'ORDER_CANCELED'
};
export class OrderNotificationService {
    async publishOrderEvent(event, payload) {
        void event;
        void payload;
        // TODO: enqueue notification for WhatsApp provider integration.
        return {
            queued: false
        };
    }
    async sendOrderConfirmed(payload) {
        return this.publishOrderEvent(orderNotificationEvents.ORDER_CONFIRMED, payload);
    }
    async sendPreparing(payload) {
        return this.publishOrderEvent(orderNotificationEvents.ORDER_PREPARING, payload);
    }
    async sendReady(payload) {
        return this.publishOrderEvent(orderNotificationEvents.ORDER_READY, payload);
    }
    async sendDelivered(payload) {
        return this.publishOrderEvent(orderNotificationEvents.ORDER_DELIVERED, payload);
    }
    async sendCanceled(payload) {
        return this.publishOrderEvent(orderNotificationEvents.ORDER_CANCELED, payload);
    }
}
