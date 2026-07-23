import { prisma } from '../../../lib/prisma.js';
import { ListPaymentProviderSettingsService } from '../../payment-provider-settings/services/list-payment-provider-settings-service.js';
import { SettingsResolverService } from './settings-resolver-service.js';
import { defaultGeneralSettings } from './settings-shared.js';
export class GetSettingsService {
    async execute(request) {
        const { organizationId } = request;
        const [organization, general, branding, businessHours, businessHourExceptions, onlineStores, events, devices, printers, printingSettings, onlineStoreSettings, deliveryFeeRules, modules, paymentsResult, effective] = await Promise.all([
            prisma.organization.findUnique({
                where: {
                    id: organizationId
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.organizationSettings.findUnique({
                where: {
                    organizationId
                }
            }),
            prisma.organizationBranding.findUnique({
                where: {
                    organizationId
                }
            }),
            prisma.businessHour.findMany({
                where: {
                    organizationId
                },
                orderBy: [
                    {
                        contextType: 'asc'
                    },
                    {
                        storeId: 'asc'
                    },
                    {
                        channel: 'asc'
                    },
                    {
                        dayOfWeek: 'asc'
                    },
                    {
                        periodIndex: 'asc'
                    }
                ]
            }),
            prisma.businessHourException.findMany({
                where: {
                    organizationId
                },
                orderBy: [
                    {
                        date: 'asc'
                    },
                    {
                        channel: 'asc'
                    }
                ]
            }),
            prisma.onlineStore.findMany({
                where: {
                    organizationId
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                    bannerUrl: true,
                    isOpen: true,
                    active: true
                },
                orderBy: {
                    name: 'asc'
                }
            }),
            prisma.event.findMany({
                where: {
                    organizationId
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    primaryColor: true,
                    secondaryColor: true,
                    logoUrl: true,
                    bannerUrl: true,
                    printingEnabled: true,
                    autoPrintEnabled: true,
                    printMode: true,
                    printerPaperSize: true,
                    totemWelcomeMessage: true,
                    totemShowPrices: true,
                    totemShowLowStock: true,
                    totemRequireCustomerName: true,
                    totemAutoResetSeconds: true,
                    totemShowLogo: true,
                    totemFullscreenRecommended: true,
                    pixEnabled: true,
                    pixPaymentExpirationMinutes: true,
                    active: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.device.findMany({
                where: {
                    organizationId
                },
                select: {
                    id: true,
                    eventId: true,
                    name: true,
                    type: true,
                    status: true,
                    authStatus: true,
                    locationName: true,
                    appVersion: true,
                    lastSeenAt: true,
                    lastHeartbeatAt: true
                },
                orderBy: {
                    name: 'asc'
                }
            }),
            prisma.eventPrinter.findMany({
                where: {
                    event: {
                        organizationId
                    }
                },
                select: {
                    id: true,
                    eventId: true,
                    name: true,
                    sector: true,
                    connectionType: true,
                    ipAddress: true,
                    port: true,
                    paperSize: true,
                    active: true
                },
                orderBy: {
                    name: 'asc'
                }
            }),
            prisma.organizationPrintingSettings.findUnique({
                where: {
                    organizationId
                }
            }),
            prisma.onlineStoreSettings.findMany({
                where: {
                    organizationId
                },
                orderBy: {
                    storeId: 'asc'
                }
            }),
            prisma.deliveryFeeRule.findMany({
                where: {
                    organizationId
                },
                orderBy: [
                    { storeId: 'asc' },
                    { sortOrder: 'asc' },
                    { name: 'asc' }
                ]
            }),
            prisma.organizationModule.findMany({
                where: {
                    organizationId
                },
                select: {
                    moduleKey: true,
                    enabled: true
                },
                orderBy: {
                    moduleKey: 'asc'
                }
            }),
            new ListPaymentProviderSettingsService().execute({
                organizationId
            }),
            new SettingsResolverService().execute(request)
        ]);
        if (!organization) {
            throw new Error('Organization not found');
        }
        const activeModules = modules
            .filter(module => module.enabled)
            .map(module => module.moduleKey);
        const hasModule = (moduleKey) => activeModules.includes(moduleKey);
        const latestUpdatedAt = [
            organization.updatedAt,
            general?.updatedAt,
            branding?.updatedAt,
            ...businessHours.map(hour => hour.updatedAt),
            ...businessHourExceptions.map(exception => exception.updatedAt),
            printingSettings?.updatedAt,
            ...onlineStoreSettings.map(settings => settings.updatedAt),
            ...deliveryFeeRules.map(rule => rule.updatedAt),
            ...onlineStores.map(store => null),
            ...events.map(event => null),
            ...devices.map(device => null)
        ]
            .filter((date) => date instanceof Date)
            .sort((a, b) => b.getTime() - a.getTime())[0] ?? organization.updatedAt;
        const permissions = {
            general: true,
            branding: true,
            businessHours: true,
            onlineOrders: hasModule('ONLINE_ORDERS'),
            delivery: hasModule('DELIVERY') || hasModule('ONLINE_ORDERS'),
            payments: hasModule('PAYMENTS'),
            printing: hasModule('PRINTING'),
            production: hasModule('EVENTS') || hasModule('ONLINE_ORDERS'),
            operation: hasModule('EVENTS') || hasModule('ONLINE_ORDERS'),
            totem: hasModule('TOTEM'),
            digitalMenu: hasModule('ONLINE_ORDERS') || hasModule('EVENTS'),
            notifications: hasModule('WHATSAPP'),
            integrations: true,
            security: true,
            audit: true
        };
        const capabilities = {
            hasEvents: hasModule('EVENTS') || events.length > 0,
            hasOnlineOrders: hasModule('ONLINE_ORDERS') || onlineStores.length > 0,
            hasDelivery: hasModule('DELIVERY'),
            hasPayments: hasModule('PAYMENTS') || paymentsResult.settings.length > 0,
            hasPrinting: hasModule('PRINTING') ||
                printers.length > 0 ||
                devices.some(device => device.type === 'PRINTER' ||
                    device.type === 'SK210'),
            hasTotem: hasModule('TOTEM') ||
                devices.some(device => device.type === 'TOTEM'),
            hasCashless: hasModule('NFC_CASHLESS'),
            hasDevices: hasModule('DEVICES') || devices.length > 0,
            hasDigitalMenu: hasModule('ONLINE_ORDERS') || onlineStores.length > 0,
            hasWhatsApp: hasModule('WHATSAPP')
        };
        capabilities.hasDelivery =
            capabilities.hasDelivery ||
                onlineStoreSettings.some(settings => settings.deliveryEnabled) ||
                deliveryFeeRules.some(rule => rule.active);
        permissions.delivery =
            permissions.delivery ||
                capabilities.hasDelivery;
        return {
            settings: {
                version: 1,
                updatedAt: latestUpdatedAt,
                general: general ?? {
                    id: null,
                    organizationId,
                    legalName: null,
                    document: null,
                    contactEmail: null,
                    contactPhone: null,
                    whatsapp: null,
                    address: null,
                    city: null,
                    state: null,
                    postalCode: null,
                    ...defaultGeneralSettings,
                    createdAt: null,
                    updatedAt: null
                },
                branding,
                businessHours: {
                    weekly: businessHours,
                    exceptions: businessHourExceptions
                },
                onlineOrders: {
                    settings: onlineStoreSettings.map(settings => ({
                        storeId: settings.storeId,
                        onlineOrderingEnabled: settings.onlineOrderingEnabled,
                        digitalMenuEnabled: settings.digitalMenuEnabled,
                        autoAcceptOrders: settings.autoAcceptOrders,
                        minimumOrderInCents: settings.minimumOrderInCents,
                        estimatedPreparationMinutes: settings.estimatedPreparationMinutes,
                        allowOrdersOutsideHours: settings.allowOrdersOutsideHours,
                        requireCustomerName: settings.requireCustomerName,
                        requireCustomerPhone: settings.requireCustomerPhone,
                        allowCustomerNotes: settings.allowCustomerNotes,
                        source: 'ONLINE_STORE_SETTINGS'
                    }))
                },
                delivery: {
                    settings: onlineStoreSettings.map(settings => ({
                        storeId: settings.storeId,
                        deliveryEnabled: settings.deliveryEnabled,
                        pickupEnabled: settings.pickupEnabled,
                        counterEnabled: settings.counterEnabled,
                        dineInEnabled: settings.dineInEnabled,
                        estimatedDeliveryMinutes: settings.estimatedDeliveryMinutes,
                        freeDeliveryAboveInCents: settings.freeDeliveryAboveInCents,
                        defaultDeliveryFeeInCents: settings.defaultDeliveryFeeInCents,
                        requireDeliveryAddress: settings.requireDeliveryAddress,
                        source: 'ONLINE_STORE_SETTINGS'
                    })),
                    rules: deliveryFeeRules
                },
                payments: null,
                printing: {
                    settings: printingSettings,
                    effective: effective.printing
                },
                production: null,
                operation: null,
                totem: null,
                digitalMenu: null,
                notifications: null,
                integrations: null,
                security: null,
                modules: activeModules,
                permissions,
                capabilities,
                existing: {
                    organization,
                    onlineStores,
                    events,
                    payments: paymentsResult.settings,
                    printing: {
                        printers,
                        eventSettings: events.map(event => ({
                            eventId: event.id,
                            eventName: event.name,
                            printingEnabled: event.printingEnabled,
                            autoPrintEnabled: event.autoPrintEnabled,
                            printMode: event.printMode,
                            printerPaperSize: event.printerPaperSize,
                            source: 'EVENT_LEGACY'
                        })),
                        organizationSettings: printingSettings
                    },
                    devices,
                    modules
                },
                sources: {
                    general: general ? 'ORGANIZATION' : 'DEFAULT',
                    branding: branding ? 'ORGANIZATION' : 'DEFAULT',
                    onlineStores: 'ONLINE_STORE',
                    events: 'EVENT_LEGACY',
                    payments: 'PAYMENT_PROVIDER_SETTINGS',
                    onlineOrders: 'ONLINE_STORE_SETTINGS_WITH_DEFAULTS',
                    delivery: 'ONLINE_STORE_SETTINGS_DELIVERY_FEE_RULE',
                    printing: printingSettings
                        ? 'ORGANIZATION_PRINTING_SETTINGS'
                        : 'EVENT_LEGACY_DEVICE_EVENT_PRINTER',
                    devices: 'DEVICE',
                    modules: 'ORGANIZATION_MODULE',
                    permissions: 'MODULE_CAPABILITY_POLICY',
                    capabilities: 'MODULES_AND_EXISTING_DATA'
                },
                effective
            }
        };
    }
}
