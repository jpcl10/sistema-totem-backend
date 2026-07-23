import { CustomerSource, OnlineOrderFulfillmentType, OnlineOrderPaymentMethod, OrderSource, SettingsChannel } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { io } from '../../../lib/socket.js';
import { mapOnlineOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js';
import { OnlineStoreSettingsService } from '../../settings/services/online-store-settings-service.js';
import { touchCustomerInteraction } from '../../customers/services/customer-interaction-service.js';
import { ResolveOrderCustomerIdentityService } from '../../customers/services/order-customer-identity-service.js';
import { OrderPrintOrchestratorService } from '../../print-jobs/services/order-print-orchestrator-service.js';
import { OrderNotificationService, orderNotificationEvents } from '../../notifications/services/order-notification-service.js';
import { buildOnlineOrderItems } from './online-order-items-builder.js';
const pickupDeliverySnapshot = {
    address: 'Retirada no balc\u00e3o',
    number: 'S/N',
    neighborhood: 'Loja',
    complement: null,
    reference: null
};
export class StoreClosedError extends Error {
    constructor(reason, nextOpeningAt) {
        super('STORE_CLOSED');
        this.reason = reason;
        this.nextOpeningAt = nextOpeningAt;
        this.code = 'STORE_CLOSED';
    }
}
export class CreateOnlineOrderService {
    async execute(request) {
        const store = await prisma.onlineStore.findUnique({
            where: {
                slug: request.slug,
                active: true
            }
        });
        if (!store) {
            throw new Error('Store not found');
        }
        const order = await prisma.$transaction(async (tx) => {
            const { orderItemsData, subtotalInCents } = await buildOnlineOrderItems({
                tx,
                organizationId: store.organizationId,
                items: request.items
            });
            const deliverySnapshot = request.fulfillment === OnlineOrderFulfillmentType.DELIVERY
                ? {
                    address: request.deliveryAddress,
                    number: request.deliveryNumber,
                    neighborhood: request.deliveryNeighborhood,
                    complement: request.deliveryComplement ?? null,
                    reference: request.deliveryReference ?? null
                }
                : pickupDeliverySnapshot;
            const operation = await new OnlineStoreSettingsService().resolveOperation({
                organizationId: store.organizationId,
                storeId: store.id,
                channel: SettingsChannel.DIGITAL_MENU,
                fulfillmentType: request.fulfillment,
                subtotalInCents,
                neighborhood: deliverySnapshot.neighborhood
            });
            if (!operation.delivery.acceptingOrders) {
                const closedReasons = new Set([
                    'STORE_INACTIVE',
                    'ONLINE_ORDERING_DISABLED',
                    'MANUALLY_CLOSED',
                    'OUTSIDE_BUSINESS_HOURS'
                ]);
                if (!closedReasons.has(operation.delivery.unavailableReason ?? '')) {
                    throw new Error(operation.delivery.unavailableReason ?? 'Store is currently unavailable');
                }
                throw new StoreClosedError(operation.delivery.unavailableReason, operation.delivery.nextOpeningAt);
            }
            if (request.fulfillment === OnlineOrderFulfillmentType.DELIVERY &&
                operation.delivery.enabled === false) {
                throw new Error('Delivery is disabled');
            }
            if (request.fulfillment === OnlineOrderFulfillmentType.PICKUP &&
                operation.delivery.pickupEnabled === false) {
                throw new Error('Pickup is disabled');
            }
            const { customer, address: customerAddress } = await new ResolveOrderCustomerIdentityService().execute({
                tx,
                organizationId: store.organizationId,
                source: CustomerSource.ONLINE,
                customer: {
                    id: request.customerId,
                    name: request.customerName,
                    phone: request.customerPhone,
                    email: request.customerEmail,
                    document: request.customerDocument,
                    notes: request.customerNotes
                },
                address: request.fulfillment === OnlineOrderFulfillmentType.DELIVERY
                    ? {
                        id: request.customerAddressId,
                        label: request.deliveryLabel,
                        recipientName: request.customerName,
                        street: request.deliveryAddress,
                        number: request.deliveryNumber,
                        neighborhood: request.deliveryNeighborhood,
                        city: request.deliveryCity,
                        state: request.deliveryState,
                        postalCode: request.deliveryPostalCode,
                        complement: request.deliveryComplement,
                        reference: request.deliveryReference
                    }
                    : null,
                shouldResolveAddress: request.fulfillment === OnlineOrderFulfillmentType.DELIVERY,
                fallbackCustomerName: request.customerName,
                fallbackCustomerPhone: request.customerPhone
            });
            const persistedDeliverySnapshot = request.fulfillment === OnlineOrderFulfillmentType.DELIVERY
                ? {
                    address: customerAddress?.street ?? deliverySnapshot.address,
                    number: customerAddress?.number ?? deliverySnapshot.number,
                    neighborhood: customerAddress?.neighborhood ?? deliverySnapshot.neighborhood,
                    complement: customerAddress?.complement ?? deliverySnapshot.complement,
                    reference: customerAddress?.reference ?? deliverySnapshot.reference
                }
                : deliverySnapshot;
            const deliveryFeeInCents = request.fulfillment === OnlineOrderFulfillmentType.DELIVERY
                ? operation.delivery.deliveryFeeInCents ?? 0
                : 0;
            const totalInCents = subtotalInCents + deliveryFeeInCents;
            const lastOrder = await tx.onlineOrder.findFirst({
                where: { storeId: store.id },
                orderBy: { orderNumber: 'desc' }
            });
            const orderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1;
            const createdOrder = await tx.onlineOrder.create({
                data: {
                    storeId: store.id,
                    orderNumber,
                    source: OrderSource.DIGITAL_MENU,
                    fulfillmentType: request.fulfillment,
                    deliveryRuleId: operation.delivery.deliveryFeeRule?.id ?? null,
                    estimatedMinutes: operation.delivery.estimatedMinutes,
                    customerId: customer?.id ?? null,
                    customerAddressId: customerAddress?.id ?? null,
                    customerName: customer?.name ?? request.customerName,
                    customerPhone: customer?.phone ?? request.customerPhone ?? '',
                    deliveryAddress: persistedDeliverySnapshot.address,
                    deliveryNumber: persistedDeliverySnapshot.number,
                    deliveryNeighborhood: persistedDeliverySnapshot.neighborhood,
                    deliveryComplement: persistedDeliverySnapshot.complement,
                    deliveryReference: persistedDeliverySnapshot.reference,
                    paymentMethod: request.paymentMethod,
                    changeForInCents: request.paymentMethod === OnlineOrderPaymentMethod.CASH
                        ? request.changeForInCents ?? null
                        : null,
                    subtotalInCents,
                    deliveryFeeInCents,
                    totalInCents,
                    notes: request.notes ?? null,
                    items: {
                        create: orderItemsData
                    }
                },
                include: {
                    store: {
                        select: {
                            id: true,
                            slug: true,
                            name: true,
                            organizationId: true
                        }
                    },
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }
                    },
                    items: {
                        include: {
                            options: true,
                            flavors: true
                        }
                    }
                }
            });
            if (customer) {
                await touchCustomerInteraction(tx, {
                    customerId: customer.id,
                    organizationId: store.organizationId,
                    source: CustomerSource.ONLINE,
                    seenAt: createdOrder.createdAt
                });
            }
            return createdOrder;
        });
        await new OrderPrintOrchestratorService().execute({
            domain: 'ONLINE_ORDER',
            orderId: order.id
        });
        await new OrderNotificationService().publishOrderEvent(orderNotificationEvents.ORDER_CREATED, {
            organizationId: store.organizationId,
            orderId: order.id,
            orderType: 'ONLINE_ORDER',
            customerId: order.customerId,
            customerPhone: order.customerPhone,
            customerName: order.customerName,
            orderNumber: order.orderNumber
        });
        if (io) {
            io.to(`organization:${store.organizationId}`).emit('online-order-created', {
                storeId: store.id,
                order
            });
            io.to(`organization:${store.organizationId}`).emit('unified-order-created', {
                order: mapOnlineOrderToUnifiedOrder(order)
            });
        }
        return {
            order
        };
    }
}
