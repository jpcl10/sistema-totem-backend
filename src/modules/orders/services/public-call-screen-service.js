import { OnlineOrderFulfillmentType, OnlineOrderStatus, OrderStatus, PaymentStatus, SettingsChannel } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { PublicEventNotFoundError, resolveCanonicalPublicEvent, resolveLegacyPublicEventSlug } from '../../events/services/public-event-resolver.js';
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js';
const maxItemsPerColumn = 10;
function firstNameOnly(name) {
    if (!name?.trim()) {
        return null;
    }
    return name.trim().split(/\s+/)[0] ?? null;
}
function publicCode(orderNumber) {
    return orderNumber ? `#${orderNumber}` : '#--';
}
function statusLabel(status) {
    return status === 'READY' ? 'Pronto' : 'Em preparo';
}
function mapEventStatus(status) {
    if (status === OrderStatus.READY) {
        return 'READY';
    }
    if (status === OrderStatus.CONFIRMED ||
        status === OrderStatus.PREPARING) {
        return 'PREPARING';
    }
    return null;
}
function mapOnlineStatus(status) {
    if (status === OnlineOrderStatus.READY) {
        return 'READY';
    }
    if (status === OnlineOrderStatus.CONFIRMED ||
        status === OnlineOrderStatus.PREPARING) {
        return 'PREPARING';
    }
    return null;
}
function mapOnlineFulfillmentType(fulfillmentType) {
    if (fulfillmentType === OnlineOrderFulfillmentType.PICKUP) {
        return 'PICKUP';
    }
    if (fulfillmentType === OnlineOrderFulfillmentType.COUNTER) {
        return 'COUNTER';
    }
    if (fulfillmentType === OnlineOrderFulfillmentType.DINE_IN) {
        return 'ON_SITE';
    }
    return null;
}
function splitOrders(orders) {
    return {
        preparing: orders
            .filter(order => order.status === 'PREPARING')
            .slice(0, maxItemsPerColumn),
        ready: orders
            .filter(order => order.status === 'READY')
            .slice(0, maxItemsPerColumn)
    };
}
function buildConfiguration() {
    return {
        showPreparing: true,
        showReady: true,
        soundEnabled: true,
        maxItemsPerColumn,
        nameMasking: 'FIRST_NAME_ONLY',
        readyRetentionMinutes: null
    };
}
export class PublicCallScreenService {
    async getBootstrap(request) {
        const context = await this.resolveContext(request);
        const [branding, orders] = await Promise.all([
            this.resolveBranding(context),
            this.listOrdersForContext(context)
        ]);
        return {
            context: {
                type: context.type,
                id: context.id,
                slug: context.slug,
                name: context.name
            },
            branding,
            configuration: buildConfiguration(),
            orders,
            serverTime: new Date().toISOString()
        };
    }
    async getOrders(request) {
        const context = await this.resolveContext(request);
        const orders = await this.listOrdersForContext(context);
        return {
            context: {
                type: context.type,
                id: context.id,
                slug: context.slug,
                name: context.name
            },
            orders,
            serverTime: new Date().toISOString()
        };
    }
    async resolveContext({ contextType, slug, organizationSlug, eventSlug }) {
        if (contextType === 'STORE') {
            const store = await prisma.onlineStore.findFirst({
                where: {
                    slug,
                    active: true
                },
                select: {
                    id: true,
                    organizationId: true,
                    slug: true,
                    name: true,
                    logoUrl: true,
                    bannerUrl: true
                }
            });
            if (!store) {
                throw new Error('Call screen context not found');
            }
            return {
                type: 'STORE',
                id: store.id,
                organizationId: store.organizationId,
                slug: store.slug,
                name: store.name,
                logoUrl: store.logoUrl,
                bannerUrl: store.bannerUrl
            };
        }
        let resolvedEvent;
        try {
            resolvedEvent = organizationSlug && eventSlug
                ? await resolveCanonicalPublicEvent({
                    organizationSlug,
                    eventSlug
                })
                : await resolveLegacyPublicEventSlug(slug);
        }
        catch (error) {
            if (error instanceof PublicEventNotFoundError) {
                throw new Error('Call screen context not found');
            }
            throw error;
        }
        const event = await prisma.event.findFirst({
            where: {
                id: resolvedEvent.id,
                organizationId: resolvedEvent.organizationId,
                active: true
            },
            select: {
                id: true,
                organizationId: true,
                slug: true,
                name: true,
                logoUrl: true,
                bannerUrl: true,
                primaryColor: true,
                secondaryColor: true,
                totemTextColor: true,
                totemBackgroundColor: true
            }
        });
        if (!event) {
            throw new Error('Call screen context not found');
        }
        return {
            type: 'EVENT',
            id: event.id,
            organizationId: event.organizationId,
            organizationSlug: resolvedEvent.organizationSlug,
            slug: event.slug,
            canonicalPath: resolvedEvent.canonicalPath,
            canonicalUrl: resolvedEvent.canonicalUrl,
            name: event.name,
            logoUrl: event.logoUrl,
            bannerUrl: event.bannerUrl,
            primaryColor: event.primaryColor,
            secondaryColor: event.secondaryColor,
            textColor: event.totemTextColor,
            backgroundColor: event.totemBackgroundColor
        };
    }
    async resolveBranding(context) {
        const effective = await new SettingsResolverService().execute({
            organizationId: context.organizationId,
            ...(context.type === 'STORE'
                ? {
                    storeId: context.id,
                    channel: SettingsChannel.DIGITAL_MENU
                }
                : {
                    eventId: context.id,
                    channel: SettingsChannel.TOTEM
                })
        });
        return {
            logoUrl: effective.branding.logoUrl.value ?? context.logoUrl ?? null,
            primaryColor: effective.branding.primaryColor.value ??
                ('primaryColor' in context ? context.primaryColor : null) ??
                null,
            secondaryColor: effective.branding.secondaryColor.value ??
                ('secondaryColor' in context ? context.secondaryColor : null) ??
                null,
            backgroundColor: effective.branding.backgroundColor.value ??
                ('backgroundColor' in context ? context.backgroundColor : null) ??
                null,
            textColor: 'textColor' in context ? context.textColor ?? null : null
        };
    }
    async listOrdersForContext(context) {
        if (context.type === 'STORE') {
            const orders = await prisma.onlineOrder.findMany({
                where: {
                    storeId: context.id,
                    store: {
                        organizationId: context.organizationId
                    },
                    fulfillmentType: {
                        in: [
                            OnlineOrderFulfillmentType.PICKUP,
                            OnlineOrderFulfillmentType.COUNTER,
                            OnlineOrderFulfillmentType.DINE_IN
                        ]
                    },
                    status: {
                        in: [
                            OnlineOrderStatus.CONFIRMED,
                            OnlineOrderStatus.PREPARING,
                            OnlineOrderStatus.READY
                        ]
                    }
                },
                select: {
                    orderNumber: true,
                    customerName: true,
                    status: true,
                    fulfillmentType: true,
                    updatedAt: true
                },
                orderBy: [
                    {
                        status: 'asc'
                    },
                    {
                        updatedAt: 'asc'
                    }
                ],
                take: maxItemsPerColumn * 3
            });
            return splitOrders(orders.flatMap(order => {
                const status = mapOnlineStatus(order.status);
                const fulfillmentType = mapOnlineFulfillmentType(order.fulfillmentType);
                if (!status || !fulfillmentType) {
                    return [];
                }
                return [
                    {
                        id: `store-${order.orderNumber}`,
                        publicCode: publicCode(order.orderNumber),
                        orderNumber: order.orderNumber,
                        status,
                        statusLabel: statusLabel(status),
                        fulfillmentType,
                        displayName: firstNameOnly(order.customerName),
                        updatedAt: order.updatedAt.toISOString(),
                        readyAt: status === 'READY'
                            ? order.updatedAt.toISOString()
                            : null
                    }
                ];
            }));
        }
        const orders = await prisma.order.findMany({
            where: {
                eventId: context.id,
                event: {
                    organizationId: context.organizationId
                },
                status: {
                    in: [
                        OrderStatus.CONFIRMED,
                        OrderStatus.PREPARING,
                        OrderStatus.READY
                    ]
                },
                paymentStatus: {
                    in: [
                        PaymentStatus.PAID,
                        PaymentStatus.NOT_REQUIRED
                    ]
                }
            },
            select: {
                orderNumber: true,
                customerName: true,
                status: true,
                updatedAt: true
            },
            orderBy: [
                {
                    status: 'asc'
                },
                {
                    updatedAt: 'asc'
                }
            ],
            take: maxItemsPerColumn * 3
        });
        return splitOrders(orders.flatMap(order => {
            const status = mapEventStatus(order.status);
            if (!status) {
                return [];
            }
            return [
                {
                    id: `event-${order.orderNumber}`,
                    publicCode: publicCode(order.orderNumber),
                    orderNumber: order.orderNumber,
                    status,
                    statusLabel: statusLabel(status),
                    fulfillmentType: 'EVENT',
                    displayName: firstNameOnly(order.customerName),
                    updatedAt: order.updatedAt.toISOString(),
                    readyAt: status === 'READY'
                        ? order.updatedAt.toISOString()
                        : null
                }
            ];
        }));
    }
}
