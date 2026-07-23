import { DeviceType, OnlineOrderPaymentMethod, OnlineOrderStatus, OrderSource, OrderStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { mapEventOrderToUnifiedOrder, mapOnlineOrderToUnifiedOrder } from '../presenters/unified-order-presenter.js';
function parseDateRange({ startDate, endDate }) {
    if (!startDate && !endDate) {
        return undefined;
    }
    const range = {};
    if (startDate) {
        const parsedStartDate = new Date(startDate);
        if (Number.isNaN(parsedStartDate.getTime())) {
            throw new Error('Invalid date range');
        }
        range.gte = parsedStartDate;
    }
    if (endDate) {
        const parsedEndDate = new Date(endDate);
        if (Number.isNaN(parsedEndDate.getTime())) {
            throw new Error('Invalid date range');
        }
        range.lte = parsedEndDate;
    }
    return range;
}
function mapSourceTypeToOrderType(sourceType) {
    if (sourceType === 'EVENT') {
        return 'EVENT_ORDER';
    }
    if (sourceType === 'ONLINE') {
        return 'ONLINE_ORDER';
    }
    return undefined;
}
function mapOrderTypeToSourceType(orderType) {
    if (orderType === 'EVENT_ORDER') {
        return 'EVENT';
    }
    if (orderType === 'ONLINE_ORDER') {
        return 'ONLINE';
    }
    return undefined;
}
function hasConflictingOrderType({ orderType, sourceType }) {
    return Boolean(orderType &&
        sourceType &&
        mapOrderTypeToSourceType(orderType) !== sourceType);
}
function isEventPaymentMethod(paymentMethod) {
    return Boolean(paymentMethod &&
        Object.values(PaymentMethod).includes(paymentMethod));
}
function isOnlinePaymentMethod(paymentMethod) {
    return Boolean(paymentMethod &&
        Object.values(OnlineOrderPaymentMethod).includes(paymentMethod));
}
function shouldLoadEventOrders({ sourceType, orderType, origin, source, storeId, fulfillmentType, paymentMethod }) {
    if (hasConflictingOrderType({ orderType, sourceType })) {
        return false;
    }
    const effectiveOrderType = orderType ?? mapSourceTypeToOrderType(sourceType);
    if (effectiveOrderType === 'ONLINE_ORDER') {
        return false;
    }
    if (storeId || fulfillmentType) {
        return false;
    }
    if (origin === 'ONLINE') {
        return false;
    }
    if (source &&
        !['EVENT', 'TOTEM', 'MANUAL_EVENT', 'POS'].includes(source)) {
        return false;
    }
    if (paymentMethod && !isEventPaymentMethod(paymentMethod)) {
        return false;
    }
    return true;
}
function shouldLoadOnlineOrders({ sourceType, orderType, origin, source, eventId, paymentMethod }) {
    if (hasConflictingOrderType({ orderType, sourceType })) {
        return false;
    }
    const effectiveOrderType = orderType ?? mapSourceTypeToOrderType(sourceType);
    if (effectiveOrderType === 'EVENT_ORDER') {
        return false;
    }
    if (eventId) {
        return false;
    }
    if (origin && origin !== 'ONLINE') {
        return false;
    }
    if (source &&
        ![
            'ONLINE_STORE',
            'MANUAL_STORE',
            'DIGITAL_MENU',
            'POS',
            'API',
            'WHATSAPP'
        ].includes(source)) {
        return false;
    }
    if (paymentMethod && !isOnlinePaymentMethod(paymentMethod)) {
        return false;
    }
    return true;
}
function mapUnifiedStatusToEventStatuses(status) {
    switch (status) {
        case 'CONFIRMED':
            return [OrderStatus.CONFIRMED];
        case 'PREPARING':
            return [OrderStatus.PREPARING];
        case 'READY':
            return [OrderStatus.READY];
        case 'COMPLETED':
            return [OrderStatus.DELIVERED];
        case 'CANCELLED':
            return [OrderStatus.CANCELLED];
        case 'NEW':
        case 'OUT_FOR_DELIVERY':
            return [];
        default:
            return undefined;
    }
}
function mapUnifiedStatusToOnlineStatuses(status) {
    switch (status) {
        case 'NEW':
            return [OnlineOrderStatus.RECEIVED];
        case 'CONFIRMED':
            return [OnlineOrderStatus.CONFIRMED];
        case 'PREPARING':
            return [OnlineOrderStatus.PREPARING];
        case 'READY':
            return [OnlineOrderStatus.READY];
        case 'OUT_FOR_DELIVERY':
            return [OnlineOrderStatus.OUT_FOR_DELIVERY];
        case 'COMPLETED':
            return [OnlineOrderStatus.DELIVERED];
        case 'CANCELLED':
            return [OnlineOrderStatus.CANCELLED];
        default:
            return undefined;
    }
}
function mapEventStatus(status) {
    switch (status) {
        case OrderStatus.CONFIRMED:
            return 'CONFIRMED';
        case OrderStatus.PREPARING:
            return 'PREPARING';
        case OrderStatus.READY:
            return 'READY';
        case OrderStatus.DELIVERED:
            return 'COMPLETED';
        case OrderStatus.CANCELLED:
            return 'CANCELLED';
    }
}
function mapOnlineStatus(status) {
    switch (status) {
        case OnlineOrderStatus.RECEIVED:
            return 'NEW';
        case OnlineOrderStatus.CONFIRMED:
            return 'CONFIRMED';
        case OnlineOrderStatus.PREPARING:
            return 'PREPARING';
        case OnlineOrderStatus.READY:
            return 'READY';
        case OnlineOrderStatus.OUT_FOR_DELIVERY:
            return 'OUT_FOR_DELIVERY';
        case OnlineOrderStatus.DELIVERED:
            return 'COMPLETED';
        case OnlineOrderStatus.CANCELLED:
            return 'CANCELLED';
    }
}
function mapOnlineSource(source) {
    switch (source) {
        case 'ONLINE_STORE':
        case 'DIGITAL_MENU':
            return OrderSource.DIGITAL_MENU;
        case 'MANUAL_STORE':
            return OrderSource.ADMIN;
        case 'POS':
            return OrderSource.POS;
        case 'API':
            return OrderSource.API;
        case 'WHATSAPP':
            return OrderSource.WHATSAPP;
        default:
            return undefined;
    }
}
function buildEventOriginWhere({ origin, source }) {
    const effectiveOrigin = source === 'MANUAL_EVENT' ? 'POS' : source ?? origin;
    if (effectiveOrigin === 'TOTEM') {
        return {
            device: {
                is: {
                    type: DeviceType.TOTEM
                }
            }
        };
    }
    if (effectiveOrigin === 'POS') {
        return {
            paymentNotes: 'Venda manual criada pelo painel'
        };
    }
    if (effectiveOrigin === 'EVENT') {
        return {
            paymentNotes: {
                not: 'Venda manual criada pelo painel'
            },
            OR: [
                {
                    deviceId: null
                },
                {
                    device: {
                        is: null
                    }
                },
                {
                    device: {
                        is: {
                            type: {
                                not: DeviceType.TOTEM
                            }
                        }
                    }
                }
            ]
        };
    }
    return {};
}
function buildEventSearchWhere(search) {
    if (!search) {
        return {};
    }
    const normalizedSearch = search.trim();
    const orderNumber = Number(normalizedSearch);
    const textSearch = {
        contains: normalizedSearch,
        mode: 'insensitive'
    };
    return {
        OR: [
            ...(Number.isInteger(orderNumber)
                ? [
                    {
                        orderNumber
                    }
                ]
                : []),
            {
                customerName: textSearch
            },
            {
                customer: {
                    is: {
                        name: {
                            contains: normalizedSearch,
                            mode: 'insensitive'
                        }
                    }
                }
            },
            {
                customer: {
                    is: {
                        phone: {
                            contains: normalizedSearch,
                            mode: 'insensitive'
                        }
                    }
                }
            },
            {
                event: {
                    is: {
                        name: {
                            contains: normalizedSearch,
                            mode: 'insensitive'
                        }
                    }
                }
            }
        ]
    };
}
function buildOnlineSearchWhere(search) {
    if (!search) {
        return {};
    }
    const normalizedSearch = search.trim();
    const orderNumber = Number(normalizedSearch);
    const textSearch = {
        contains: normalizedSearch,
        mode: 'insensitive'
    };
    return {
        OR: [
            ...(Number.isInteger(orderNumber)
                ? [
                    {
                        orderNumber
                    }
                ]
                : []),
            {
                customerName: textSearch
            },
            {
                customerPhone: textSearch
            },
            {
                customer: {
                    is: {
                        name: {
                            contains: normalizedSearch,
                            mode: 'insensitive'
                        }
                    }
                }
            },
            {
                customer: {
                    is: {
                        phone: {
                            contains: normalizedSearch,
                            mode: 'insensitive'
                        }
                    }
                }
            },
            {
                store: {
                    is: {
                        name: {
                            contains: normalizedSearch,
                            mode: 'insensitive'
                        }
                    }
                }
            }
        ]
    };
}
function buildEventWhere(request) {
    const dateRange = parseDateRange(request);
    const eventStatuses = mapUnifiedStatusToEventStatuses(request.status);
    const originWhere = buildEventOriginWhere({
        origin: request.origin,
        source: request.source
    });
    const searchWhere = buildEventSearchWhere(request.search);
    const andFilters = [originWhere, searchWhere].filter(filter => {
        return Object.keys(filter).length > 0;
    });
    if (eventStatuses?.length === 0) {
        return {
            id: '__NO_EVENT_STATUS_MATCH__'
        };
    }
    return {
        ...(request.eventId ? { eventId: request.eventId } : {}),
        ...(request.customerId ? { customerId: request.customerId } : {}),
        ...(request.paymentStatus
            ? { paymentStatus: request.paymentStatus }
            : {}),
        ...(request.paymentMethod && isEventPaymentMethod(request.paymentMethod)
            ? { paymentMethod: request.paymentMethod }
            : {}),
        ...(eventStatuses ? { status: { in: eventStatuses } } : {}),
        ...(dateRange ? { [request.dateField]: dateRange } : {}),
        ...(andFilters.length > 0 ? { AND: andFilters } : {}),
        event: {
            organizationId: request.organizationId
        }
    };
}
function buildOnlineWhere(request) {
    const dateRange = parseDateRange(request);
    const onlineStatuses = mapUnifiedStatusToOnlineStatuses(request.status);
    const source = mapOnlineSource(request.source);
    const searchWhere = buildOnlineSearchWhere(request.search);
    if (onlineStatuses?.length === 0) {
        return {
            id: '__NO_ONLINE_STATUS_MATCH__'
        };
    }
    return {
        ...(request.storeId ? { storeId: request.storeId } : {}),
        ...(request.customerId ? { customerId: request.customerId } : {}),
        ...(request.paymentStatus
            ? { paymentStatus: request.paymentStatus }
            : {}),
        ...(request.paymentMethod && isOnlinePaymentMethod(request.paymentMethod)
            ? { paymentMethod: request.paymentMethod }
            : {}),
        ...(request.fulfillmentType
            ? { fulfillmentType: request.fulfillmentType }
            : {}),
        ...(source ? { source } : {}),
        ...(onlineStatuses ? { status: { in: onlineStatuses } } : {}),
        ...(dateRange ? { [request.dateField]: dateRange } : {}),
        ...(Object.keys(searchWhere).length > 0 ? { AND: [searchWhere] } : {}),
        store: {
            organizationId: request.organizationId
        }
    };
}
function getOrderValue(order, sortBy) {
    switch (sortBy) {
        case 'paidAt':
            return order.payment.paidAt
                ? new Date(order.payment.paidAt).getTime()
                : 0;
        case 'totalInCents':
            return order.totals.totalInCents;
        case 'orderNumber':
            return order.orderNumber;
        case 'createdAt':
        default:
            return new Date(order.createdAt).getTime();
    }
}
function compareOrders({ firstOrder, secondOrder, sortBy, sortOrder }) {
    const firstValue = getOrderValue(firstOrder, sortBy);
    const secondValue = getOrderValue(secondOrder, sortBy);
    if (firstValue === secondValue) {
        const firstCreatedAt = new Date(firstOrder.createdAt).getTime();
        const secondCreatedAt = new Date(secondOrder.createdAt).getTime();
        return secondCreatedAt - firstCreatedAt;
    }
    return sortOrder === 'asc'
        ? firstValue - secondValue
        : secondValue - firstValue;
}
function sortFieldForNativeQuery(sortBy) {
    return sortBy;
}
function addSummaryCount(accumulator, key, value) {
    accumulator[key] = (accumulator[key] ?? 0) + value;
}
function getEventOriginSummaryQueries(where) {
    return {
        event: {
            ...where,
            paymentNotes: {
                not: 'Venda manual criada pelo painel'
            },
            OR: [
                {
                    deviceId: null
                },
                {
                    device: {
                        is: null
                    }
                },
                {
                    device: {
                        is: {
                            type: {
                                not: DeviceType.TOTEM
                            }
                        }
                    }
                }
            ]
        },
        totem: {
            ...where,
            device: {
                is: {
                    type: DeviceType.TOTEM
                }
            }
        },
        pos: {
            ...where,
            paymentNotes: 'Venda manual criada pelo painel'
        }
    };
}
async function buildSummary({ eventWhere, onlineWhere, includeEventOrders, includeOnlineOrders }) {
    const summary = {
        origins: {},
        statuses: {}
    };
    const [eventStatusGroups, onlineStatusGroups, eventOriginCounts, onlineOriginCount] = await Promise.all([
        includeEventOrders && eventWhere
            ? prisma.order.groupBy({
                by: ['status'],
                where: eventWhere,
                _count: {
                    _all: true
                }
            })
            : Promise.resolve([]),
        includeOnlineOrders && onlineWhere
            ? prisma.onlineOrder.groupBy({
                by: ['status'],
                where: onlineWhere,
                _count: {
                    _all: true
                }
            })
            : Promise.resolve([]),
        includeEventOrders && eventWhere
            ? (async () => {
                const originQueries = getEventOriginSummaryQueries(eventWhere);
                const [eventCount, totemCount, posCount] = await Promise.all([
                    prisma.order.count({ where: originQueries.event }),
                    prisma.order.count({ where: originQueries.totem }),
                    prisma.order.count({ where: originQueries.pos })
                ]);
                return {
                    eventCount,
                    totemCount,
                    posCount
                };
            })()
            : Promise.resolve({
                eventCount: 0,
                totemCount: 0,
                posCount: 0
            }),
        includeOnlineOrders && onlineWhere
            ? prisma.onlineOrder.count({ where: onlineWhere })
            : Promise.resolve(0)
    ]);
    for (const group of eventStatusGroups) {
        addSummaryCount(summary.statuses, mapEventStatus(group.status), group._count._all);
    }
    for (const group of onlineStatusGroups) {
        addSummaryCount(summary.statuses, mapOnlineStatus(group.status), group._count._all);
    }
    if (eventOriginCounts.eventCount > 0) {
        summary.origins.EVENT = eventOriginCounts.eventCount;
    }
    if (eventOriginCounts.totemCount > 0) {
        summary.origins.TOTEM = eventOriginCounts.totemCount;
    }
    if (eventOriginCounts.posCount > 0) {
        summary.origins.POS = eventOriginCounts.posCount;
    }
    if (onlineOriginCount > 0) {
        summary.origins.ONLINE = onlineOriginCount;
    }
    return summary;
}
export class ListUnifiedOrdersService {
    async execute(request) {
        const includeEventOrders = shouldLoadEventOrders(request);
        const includeOnlineOrders = shouldLoadOnlineOrders(request);
        const eventWhere = includeEventOrders
            ? buildEventWhere(request)
            : undefined;
        const onlineWhere = includeOnlineOrders
            ? buildOnlineWhere(request)
            : undefined;
        const take = request.page * request.limit;
        const [eventOrders, onlineOrders, eventTotal, onlineTotal, summary] = await Promise.all([
            includeEventOrders && eventWhere
                ? prisma.order.findMany({
                    where: eventWhere,
                    include: {
                        event: {
                            select: {
                                id: true,
                                name: true,
                                organizationId: true,
                                printingEnabled: true
                            }
                        },
                        customer: {
                            select: {
                                id: true,
                                name: true,
                                phone: true
                            }
                        },
                        device: {
                            select: {
                                id: true,
                                type: true,
                                name: true
                            }
                        },
                        items: {
                            include: {
                                options: true
                            }
                        },
                        printJobs: {
                            select: {
                                id: true,
                                status: true
                            }
                        },
                        paymentTransactions: {
                            select: {
                                id: true
                            }
                        }
                    },
                    orderBy: [
                        {
                            [sortFieldForNativeQuery(request.sortBy)]: request.sortOrder
                        },
                        {
                            createdAt: 'desc'
                        }
                    ],
                    take
                })
                : Promise.resolve([]),
            includeOnlineOrders && onlineWhere
                ? prisma.onlineOrder.findMany({
                    where: onlineWhere,
                    include: {
                        store: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                organizationId: true,
                                printingEnabled: true
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
                                options: true
                            }
                        },
                        printJobs: {
                            select: {
                                id: true,
                                status: true
                            }
                        }
                    },
                    orderBy: [
                        {
                            [sortFieldForNativeQuery(request.sortBy)]: request.sortOrder
                        },
                        {
                            createdAt: 'desc'
                        }
                    ],
                    take
                })
                : Promise.resolve([]),
            includeEventOrders && eventWhere
                ? prisma.order.count({ where: eventWhere })
                : Promise.resolve(0),
            includeOnlineOrders && onlineWhere
                ? prisma.onlineOrder.count({ where: onlineWhere })
                : Promise.resolve(0),
            buildSummary({
                eventWhere,
                onlineWhere,
                includeEventOrders,
                includeOnlineOrders
            })
        ]);
        const unifiedOrders = [
            ...eventOrders.map(order => mapEventOrderToUnifiedOrder(order)),
            ...onlineOrders.map(order => mapOnlineOrderToUnifiedOrder(order))
        ].sort((firstOrder, secondOrder) => {
            return compareOrders({
                firstOrder,
                secondOrder,
                sortBy: request.sortBy,
                sortOrder: request.sortOrder
            });
        });
        const total = eventTotal + onlineTotal;
        const skip = (request.page - 1) * request.limit;
        const data = unifiedOrders.slice(skip, skip + request.limit);
        return {
            data,
            pagination: {
                page: request.page,
                limit: request.limit,
                total,
                totalPages: Math.ceil(total / request.limit)
            },
            summary: {
                total,
                origins: summary.origins,
                statuses: summary.statuses
            }
        };
    }
}
