import { AuditAction, DeviceType, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { enqueuePrintJob } from '../../../infra/queues/index.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js';
function getMetadataValue(metadata, key) {
    if (typeof metadata !== 'object' ||
        metadata === null ||
        Array.isArray(metadata)) {
        return null;
    }
    const value = metadata[key];
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }
    return null;
}
function isPrinterSector(value) {
    return value === 'FULL_ORDER' || value === 'BAR' || value === 'KITCHEN';
}
function isPrintablePaymentStatus(paymentStatus) {
    return (paymentStatus === PaymentStatus.PAID ||
        paymentStatus === PaymentStatus.NOT_REQUIRED);
}
function findTargetsBySector(targets, sector) {
    return targets.filter(target => target.sector === sector);
}
function mapPrintingSectorToPrinterSector(value) {
    if (value === 'COOK' || value === 'KITCHEN') {
        return 'KITCHEN';
    }
    if (value === 'BAR') {
        return 'BAR';
    }
    return 'FULL_ORDER';
}
function normalizePrintMode({ sourcePrintMode, splitBySector }) {
    if (sourcePrintMode === 'FULL_ORDER' && splitBySector) {
        return 'BY_SECTOR';
    }
    return sourcePrintMode;
}
function shouldPrintBySettings({ settings, source }) {
    const sourceSettings = settings.sources[source];
    return Boolean(settings.printingEnabled &&
        settings.autoPrintEnabled &&
        sourceSettings?.enabled &&
        sourceSettings?.autoPrint);
}
function resolvePaperSize({ targetPaperSize, settingsPaperSize }) {
    return targetPaperSize ?? settingsPaperSize;
}
async function createJobsIdempotently({ jobsToCreate, organizationId, eventId }) {
    const printJobs = [];
    const audit = new CreateAuditLogService();
    for (const job of jobsToCreate) {
        const existingJob = await prisma.eventPrintJob.findUnique({
            where: {
                idempotencyKey: job.idempotencyKey
            },
            include: {
                printer: true,
                device: true
            }
        });
        if (existingJob) {
            if (!existingJob.deviceId) {
                await enqueuePrintJob(existingJob.id);
            }
            printJobs.push(existingJob);
            continue;
        }
        try {
            const printJob = await prisma.eventPrintJob.create({
                data: job,
                include: {
                    printer: true,
                    device: true
                }
            });
            await audit.execute({
                organizationId,
                eventId,
                entity: 'PrintJob',
                entityId: printJob.id,
                action: AuditAction.PRINT_JOB_CREATED,
                description: 'Impressao criada',
                metadata: {
                    printJobId: printJob.id,
                    orderId: printJob.orderId,
                    onlineOrderId: printJob.onlineOrderId,
                    printerId: printJob.printerId,
                    deviceId: printJob.deviceId,
                    idempotencyKey: printJob.idempotencyKey
                }
            });
            if (!printJob.deviceId) {
                await enqueuePrintJob(printJob.id);
            }
            printJobs.push(printJob);
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                const duplicatedJob = await prisma.eventPrintJob.findUnique({
                    where: {
                        idempotencyKey: job.idempotencyKey
                    },
                    include: {
                        printer: true,
                        device: true
                    }
                });
                if (duplicatedJob) {
                    if (!duplicatedJob.deviceId) {
                        await enqueuePrintJob(duplicatedJob.id);
                    }
                    printJobs.push(duplicatedJob);
                    continue;
                }
            }
            throw error;
        }
    }
    return printJobs;
}
export class OrderPrintOrchestratorService {
    async execute({ domain, orderId }) {
        if (domain === 'EVENT_ORDER') {
            return this.createForEventOrder(orderId);
        }
        return this.createForOnlineOrder(orderId);
    }
    async createForEventOrder(orderId) {
        const order = await prisma.order.findFirst({
            where: {
                id: orderId
            },
            include: {
                event: true,
                printJobs: true,
                device: true,
                items: {
                    include: {
                        catalogProduct: {
                            include: {
                                catalogCategory: true
                            }
                        },
                        options: true,
                        flavors: true
                    }
                }
            }
        });
        if (!order) {
            throw new Error('Order not found');
        }
        const sourceKey = order.device?.type === DeviceType.TOTEM
            ? 'TOTEM'
            : order.paymentNotes === 'Venda manual criada pelo painel'
                ? 'MANUAL_EVENT'
                : 'EVENT';
        const effective = await new SettingsResolverService().execute({
            organizationId: order.event.organizationId,
            eventId: order.eventId,
            deviceId: order.deviceId ?? undefined
        });
        const printingSettings = effective.printing;
        if (!shouldPrintBySettings({
            settings: printingSettings,
            source: sourceKey
        }) ||
            !isPrintablePaymentStatus(order.paymentStatus) ||
            order.items.length === 0) {
            return {
                printJobs: []
            };
        }
        if (order.printJobs.length > 0) {
            return {
                printJobs: order.printJobs
            };
        }
        const deviceTargets = await this.resolveDeviceTargets({
            organizationId: order.event.organizationId,
            eventId: order.eventId,
            storeId: null,
            settings: printingSettings
        });
        const legacyPrinters = await prisma.eventPrinter.findMany({
            where: {
                eventId: order.eventId,
                active: true
            }
        });
        const legacyTargets = legacyPrinters.map(printer => ({
            source: 'LEGACY_PRINTER',
            id: printer.id,
            deviceId: null,
            printerId: printer.id,
            sector: printer.sector,
            connectionType: printer.connectionType,
            paperSize: printer.paperSize
        }));
        const targets = deviceTargets.length > 0 ? deviceTargets : legacyTargets;
        const source = sourceKey;
        const items = order.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            sector: item.catalogProduct?.catalogCategory?.sector ?? null,
            notes: item.notes,
            options: [
                ...item.flavors
                    .sort((a, b) => a.position - b.position)
                    .map(flavor => ({
                    groupName: 'Meio a meio',
                    optionName: `1/2 ${flavor.flavorName}`
                })),
                ...item.options.map(option => ({
                    groupName: option.groupName,
                    optionName: option.optionName
                }))
            ]
        }));
        const basePayload = {
            domain: 'EVENT_ORDER',
            eventName: order.event.name,
            orderId: order.id,
            orderNumber: order.orderNumber,
            source,
            manualSale: sourceKey === 'MANUAL_EVENT',
            customerName: order.customerName,
            createdAt: order.createdAt.toISOString(),
            fulfillment: 'ON_SITE',
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            totalInCents: order.totalInCents,
            notes: order.paymentNotes,
            paperSize: printingSettings.paperSize,
            layout: {
                showLogo: printingSettings.showLogo,
                showPrices: printingSettings.showPrices,
                showQrCode: printingSettings.showQrCode,
                showPayment: printingSettings.showPayment,
                showOrderSource: printingSettings.showOrderSource,
                showOrderNotes: printingSettings.showOrderNotes,
                showItemNotes: printingSettings.showItemNotes,
                showOptions: printingSettings.showOptions
            }
        };
        const jobsToCreate = this.buildJobs({
            domain: 'EVENT_ORDER',
            orderId: order.id,
            eventId: order.eventId,
            onlineOrderId: null,
            storeId: null,
            printMode: normalizePrintMode({
                sourcePrintMode: printingSettings.sources[sourceKey].printMode,
                splitBySector: printingSettings.splitBySector
            }),
            targets,
            basePayload,
            items
        });
        const printJobs = await createJobsIdempotently({
            jobsToCreate,
            organizationId: order.event.organizationId,
            eventId: order.eventId
        });
        return {
            printJobs
        };
    }
    async createForOnlineOrder(orderId) {
        const order = await prisma.onlineOrder.findFirst({
            where: {
                id: orderId
            },
            include: {
                store: true,
                printJobs: true,
                items: {
                    include: {
                        catalogProduct: {
                            include: {
                                catalogCategory: true
                            }
                        },
                        options: true,
                        flavors: true
                    }
                }
            }
        });
        if (!order) {
            throw new Error('Online order not found');
        }
        const sourceKey = order.source === 'ADMIN'
            ? 'MANUAL_STORE'
            : 'ONLINE_STORE';
        const effective = await new SettingsResolverService().execute({
            organizationId: order.store.organizationId,
            storeId: order.storeId
        });
        const printingSettings = effective.printing;
        if (!shouldPrintBySettings({
            settings: printingSettings,
            source: sourceKey
        }) ||
            !isPrintablePaymentStatus(order.paymentStatus) ||
            order.items.length === 0) {
            return {
                printJobs: []
            };
        }
        if (order.printJobs.length > 0) {
            return {
                printJobs: order.printJobs
            };
        }
        const targets = await this.resolveDeviceTargets({
            organizationId: order.store.organizationId,
            eventId: null,
            storeId: order.storeId,
            settings: printingSettings
        });
        const items = order.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            sector: item.catalogProduct?.catalogCategory?.sector ?? null,
            notes: item.notes,
            options: [
                ...item.flavors
                    .sort((a, b) => a.position - b.position)
                    .map(flavor => ({
                    groupName: 'Meio a meio',
                    optionName: `1/2 ${flavor.flavorName}`
                })),
                ...item.options.map(option => ({
                    groupName: option.groupName,
                    optionName: option.optionName
                }))
            ]
        }));
        const isDelivery = order.fulfillmentType === 'DELIVERY';
        const basePayload = {
            domain: 'ONLINE_ORDER',
            storeName: order.store.name,
            onlineOrderId: order.id,
            orderNumber: order.orderNumber,
            source: order.source,
            manualSale: order.source === 'ADMIN',
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            createdAt: order.createdAt.toISOString(),
            fulfillment: order.fulfillmentType,
            deliveryAddress: isDelivery
                ? {
                    address: order.deliveryAddress,
                    number: order.deliveryNumber,
                    neighborhood: order.deliveryNeighborhood,
                    complement: order.deliveryComplement,
                    reference: order.deliveryReference
                }
                : null,
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            subtotalInCents: order.subtotalInCents,
            deliveryFeeInCents: order.deliveryFeeInCents,
            totalInCents: order.totalInCents,
            notes: order.notes,
            paperSize: printingSettings.paperSize,
            layout: {
                showLogo: printingSettings.showLogo,
                showPrices: printingSettings.showPrices,
                showQrCode: printingSettings.showQrCode,
                showPayment: printingSettings.showPayment,
                showOrderSource: printingSettings.showOrderSource,
                showOrderNotes: printingSettings.showOrderNotes,
                showItemNotes: printingSettings.showItemNotes,
                showOptions: printingSettings.showOptions
            }
        };
        const jobsToCreate = this.buildJobs({
            domain: 'ONLINE_ORDER',
            orderId: null,
            eventId: null,
            onlineOrderId: order.id,
            storeId: order.storeId,
            printMode: normalizePrintMode({
                sourcePrintMode: printingSettings.sources[sourceKey].printMode,
                splitBySector: printingSettings.splitBySector
            }),
            targets,
            basePayload,
            items
        });
        const printJobs = await createJobsIdempotently({
            jobsToCreate,
            organizationId: order.store.organizationId,
            eventId: null
        });
        return {
            printJobs
        };
    }
    async resolveDeviceTargets({ organizationId, eventId, storeId, settings }) {
        const configuredTargets = [
            {
                deviceId: settings.defaultPrinterDeviceId,
                sector: 'GENERAL'
            },
            {
                deviceId: settings.kitchenPrinterDeviceId,
                sector: 'COOK'
            },
            {
                deviceId: settings.barPrinterDeviceId,
                sector: 'BAR'
            },
            {
                deviceId: settings.expeditionPrinterDeviceId,
                sector: 'GENERAL'
            }
        ].filter((target) => Boolean(target.deviceId));
        if (configuredTargets.length > 0) {
            const devices = await prisma.device.findMany({
                where: {
                    id: {
                        in: configuredTargets.map(target => target.deviceId)
                    },
                    organizationId,
                    status: 'ACTIVE',
                    type: {
                        in: [DeviceType.PRINTER, DeviceType.SK210]
                    }
                }
            });
            const devicesById = new Map(devices.map(device => [device.id, device]));
            const printTargets = [];
            for (const target of configuredTargets) {
                const device = devicesById.get(target.deviceId);
                if (!device) {
                    continue;
                }
                const connectionType = getMetadataValue(device.metadata, 'connectionType') ??
                    (device.type === DeviceType.SK210 ? 'SK210_LOCAL' : 'TCP_IP');
                printTargets.push({
                    source: 'DEVICE',
                    id: device.id,
                    deviceId: device.id,
                    printerId: null,
                    sector: mapPrintingSectorToPrinterSector(target.sector),
                    connectionType,
                    paperSize: resolvePaperSize({
                        targetPaperSize: getMetadataValue(device.metadata, 'paperSize'),
                        settingsPaperSize: settings.paperSize
                    })
                });
            }
            return printTargets;
        }
        const devices = await prisma.device.findMany({
            where: {
                organizationId,
                ...(eventId ? { eventId } : {}),
                ...(storeId ? { storeId } : {}),
                status: 'ACTIVE',
                type: {
                    in: [DeviceType.PRINTER, DeviceType.SK210]
                }
            }
        });
        return devices.map(device => {
            const metadataSector = getMetadataValue(device.metadata, 'printerSector');
            const connectionType = getMetadataValue(device.metadata, 'connectionType') ??
                (device.type === DeviceType.SK210 ? 'SK210_LOCAL' : 'TCP_IP');
            return {
                source: 'DEVICE',
                id: device.id,
                deviceId: device.id,
                printerId: null,
                sector: isPrinterSector(metadataSector)
                    ? metadataSector
                    : mapPrintingSectorToPrinterSector(metadataSector),
                connectionType,
                paperSize: resolvePaperSize({
                    targetPaperSize: getMetadataValue(device.metadata, 'paperSize'),
                    settingsPaperSize: settings.paperSize
                })
            };
        });
    }
    buildJobs({ domain, orderId, eventId, onlineOrderId, storeId, printMode, targets, basePayload, items }) {
        const jobsToCreate = [];
        const domainOrderId = orderId ?? onlineOrderId;
        if (!domainOrderId) {
            return jobsToCreate;
        }
        const fullOrderTargets = findTargetsBySector(targets, 'FULL_ORDER');
        for (const target of fullOrderTargets) {
            jobsToCreate.push({
                eventId,
                orderId,
                storeId,
                onlineOrderId,
                idempotencyKey: [
                    'auto',
                    domain,
                    domainOrderId,
                    target.source,
                    target.id,
                    'FULL_ORDER'
                ].join(':'),
                printerId: target.printerId,
                deviceId: target.deviceId,
                sector: 'KITCHEN',
                payload: {
                    ...basePayload,
                    type: 'FULL_ORDER',
                    title: 'PEDIDO COMPLETO',
                    printerSector: 'FULL_ORDER',
                    connectionType: target.connectionType,
                    printTargetSource: target.source,
                    printTargetId: target.id,
                    paperSize: target.paperSize,
                    items
                }
            });
        }
        if (printMode === 'BY_SECTOR' || printMode === 'BOTH') {
            const sectors = ['BAR', 'KITCHEN'];
            for (const sector of sectors) {
                const sectorItems = items.filter(item => item.sector === sector);
                if (sectorItems.length === 0) {
                    continue;
                }
                const sectorTargets = findTargetsBySector(targets, sector);
                for (const target of sectorTargets) {
                    jobsToCreate.push({
                        eventId,
                        orderId,
                        storeId,
                        onlineOrderId,
                        idempotencyKey: [
                            'auto',
                            domain,
                            domainOrderId,
                            target.source,
                            target.id,
                            sector
                        ].join(':'),
                        printerId: target.printerId,
                        deviceId: target.deviceId,
                        sector,
                        payload: {
                            ...basePayload,
                            type: 'SECTOR',
                            title: sector === 'BAR' ? 'COMANDA BAR' : 'COMANDA COZINHA',
                            sector,
                            printerSector: sector,
                            connectionType: target.connectionType,
                            printTargetSource: target.source,
                            printTargetId: target.id,
                            paperSize: target.paperSize,
                            items: sectorItems
                        }
                    });
                }
            }
        }
        return jobsToCreate;
    }
}
