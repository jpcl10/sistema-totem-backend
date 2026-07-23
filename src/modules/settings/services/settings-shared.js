import { SettingsChannel, SettingsContextType } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
export const defaultGeneralSettings = {
    timezone: 'America/Sao_Paulo',
    locale: 'pt-BR',
    currency: 'BRL'
};
export const defaultOnlineStoreSettings = {
    onlineOrderingEnabled: true,
    digitalMenuEnabled: true,
    deliveryEnabled: false,
    pickupEnabled: true,
    counterEnabled: false,
    dineInEnabled: false,
    allowOrdersOutsideHours: false,
    autoAcceptOrders: false,
    minimumOrderInCents: 0,
    estimatedPreparationMinutes: 30,
    estimatedDeliveryMinutes: 45,
    freeDeliveryAboveInCents: null,
    defaultDeliveryFeeInCents: 0,
    closedMessage: null,
    checkoutNotice: null,
    orderConfirmationMessage: null,
    requireCustomerName: true,
    requireCustomerPhone: true,
    requireDeliveryAddress: true,
    allowCustomerNotes: true
};
export const printingSources = [
    'ONLINE_STORE',
    'MANUAL_STORE',
    'EVENT',
    'MANUAL_EVENT',
    'TOTEM',
    'POS',
    'API',
    'WAITER'
];
export const printingSectors = [
    'COOK',
    'BAR',
    'GENERAL'
];
export const defaultPrintingSourceSettings = {
    enabled: true,
    autoPrint: true,
    printMode: 'FULL_ORDER'
};
export const defaultPrintingSettings = {
    printingEnabled: false,
    autoPrintEnabled: false,
    allowReprint: true,
    splitBySector: false,
    mergeCopies: true,
    defaultPrinterDeviceId: null,
    kitchenPrinterDeviceId: null,
    barPrinterDeviceId: null,
    expeditionPrinterDeviceId: null,
    paperSize: '80mm',
    showLogo: false,
    showPrices: true,
    showQrCode: false,
    showPayment: true,
    showOrderSource: true,
    showOrderNotes: true,
    showItemNotes: true,
    showOptions: true,
    sources: Object.fromEntries(printingSources.map(source => [
        source,
        { ...defaultPrintingSourceSettings }
    ])),
    sectors: Object.fromEntries(printingSectors.map(sector => [
        sector,
        { enabled: true }
    ]))
};
export function sourceValue(value, source) {
    return {
        value,
        source
    };
}
export function toDateOnly(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
export async function ensureStoreBelongsToOrganization(organizationId, storeId) {
    if (!storeId) {
        return null;
    }
    const store = await prisma.onlineStore.findFirst({
        where: {
            id: storeId,
            organizationId
        }
    });
    if (!store) {
        throw new Error('Store not found');
    }
    return store;
}
export function normalizeContext(contextType, storeId) {
    if (contextType === SettingsContextType.ONLINE_STORE && !storeId) {
        throw new Error('storeId is required for ONLINE_STORE context');
    }
    if (contextType === SettingsContextType.ORGANIZATION && storeId) {
        throw new Error('storeId is not allowed for ORGANIZATION context');
    }
    return {
        contextType,
        storeId: storeId ?? null
    };
}
export function normalizeChannel(channel) {
    return channel ?? SettingsChannel.ALL;
}
export function normalizeNeighborhood(neighborhood) {
    return neighborhood
        ?.trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() ?? null;
}
