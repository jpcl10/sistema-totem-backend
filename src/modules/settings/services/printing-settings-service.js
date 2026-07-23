import { AuditAction } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { defaultPrintingSettings, defaultPrintingSourceSettings, printingSectors, printingSources } from './settings-shared.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function normalizeSources(value) {
    const input = isRecord(value) ? value : {};
    return Object.fromEntries(printingSources.map(source => {
        const current = isRecord(input[source])
            ? input[source]
            : {};
        return [
            source,
            {
                enabled: typeof current.enabled === 'boolean'
                    ? current.enabled
                    : defaultPrintingSourceSettings.enabled,
                autoPrint: typeof current.autoPrint === 'boolean'
                    ? current.autoPrint
                    : defaultPrintingSourceSettings.autoPrint,
                printMode: current.printMode === 'FULL_ORDER' ||
                    current.printMode === 'BY_SECTOR' ||
                    current.printMode === 'BOTH'
                    ? current.printMode
                    : defaultPrintingSourceSettings.printMode
            }
        ];
    }));
}
function normalizeSectors(value) {
    const input = isRecord(value) ? value : {};
    return Object.fromEntries(printingSectors.map(sector => {
        const current = isRecord(input[sector])
            ? input[sector]
            : {};
        return [
            sector,
            {
                enabled: typeof current.enabled === 'boolean'
                    ? current.enabled
                    : true
            }
        ];
    }));
}
function mergeSources(current, next) {
    if (!next) {
        return current;
    }
    const merged = { ...current };
    for (const source of printingSources) {
        merged[source] = {
            ...merged[source],
            ...(next[source] ?? {})
        };
    }
    return merged;
}
function mergeSectors(current, next) {
    if (!next) {
        return current;
    }
    const merged = { ...current };
    for (const sector of printingSectors) {
        merged[sector] = {
            ...merged[sector],
            ...(next[sector] ?? {})
        };
    }
    return merged;
}
function toEffective(settings) {
    if (!settings) {
        return {
            ...defaultPrintingSettings,
            source: 'DEFAULT',
            fallback: {
                used: false,
                reason: null
            }
        };
    }
    return {
        ...defaultPrintingSettings,
        ...settings,
        sources: normalizeSources(settings.sources),
        sectors: normalizeSectors(settings.sectors),
        source: 'ORGANIZATION_PRINTING_SETTINGS',
        fallback: {
            used: false,
            reason: null
        }
    };
}
async function assertDevicesBelongToOrganization(organizationId, deviceIds) {
    const ids = Array.from(new Set(deviceIds.filter((id) => Boolean(id))));
    if (ids.length === 0) {
        return;
    }
    const count = await prisma.device.count({
        where: {
            id: {
                in: ids
            },
            organizationId
        }
    });
    if (count !== ids.length) {
        throw new Error('One or more printer devices were not found');
    }
}
export class PrintingSettingsService {
    async getOrDefaults({ organizationId }) {
        const settings = await prisma.organizationPrintingSettings.findUnique({
            where: {
                organizationId
            }
        });
        return {
            settings,
            effective: toEffective(settings),
            source: settings ? 'ORGANIZATION_PRINTING_SETTINGS' : 'DEFAULT'
        };
    }
    async update({ organizationId, userId, data }) {
        await assertDevicesBelongToOrganization(organizationId, [
            data.defaultPrinterDeviceId,
            data.kitchenPrinterDeviceId,
            data.barPrinterDeviceId,
            data.expeditionPrinterDeviceId
        ]);
        const current = await this.getOrDefaults({
            organizationId
        });
        const nextSources = mergeSources(current.effective.sources, data.sources);
        const nextSectors = mergeSectors(current.effective.sectors, data.sectors);
        const scalarData = {
            ...(data.printingEnabled !== undefined && {
                printingEnabled: data.printingEnabled
            }),
            ...(data.autoPrintEnabled !== undefined && {
                autoPrintEnabled: data.autoPrintEnabled
            }),
            ...(data.allowReprint !== undefined && {
                allowReprint: data.allowReprint
            }),
            ...(data.splitBySector !== undefined && {
                splitBySector: data.splitBySector
            }),
            ...(data.mergeCopies !== undefined && {
                mergeCopies: data.mergeCopies
            }),
            ...(data.defaultPrinterDeviceId !== undefined && {
                defaultPrinterDeviceId: data.defaultPrinterDeviceId
            }),
            ...(data.kitchenPrinterDeviceId !== undefined && {
                kitchenPrinterDeviceId: data.kitchenPrinterDeviceId
            }),
            ...(data.barPrinterDeviceId !== undefined && {
                barPrinterDeviceId: data.barPrinterDeviceId
            }),
            ...(data.expeditionPrinterDeviceId !== undefined && {
                expeditionPrinterDeviceId: data.expeditionPrinterDeviceId
            }),
            ...(data.paperSize !== undefined && {
                paperSize: data.paperSize
            }),
            ...(data.showLogo !== undefined && {
                showLogo: data.showLogo
            }),
            ...(data.showPrices !== undefined && {
                showPrices: data.showPrices
            }),
            ...(data.showQrCode !== undefined && {
                showQrCode: data.showQrCode
            }),
            ...(data.showPayment !== undefined && {
                showPayment: data.showPayment
            }),
            ...(data.showOrderSource !== undefined && {
                showOrderSource: data.showOrderSource
            }),
            ...(data.showOrderNotes !== undefined && {
                showOrderNotes: data.showOrderNotes
            }),
            ...(data.showItemNotes !== undefined && {
                showItemNotes: data.showItemNotes
            }),
            ...(data.showOptions !== undefined && {
                showOptions: data.showOptions
            })
        };
        const settings = await prisma.organizationPrintingSettings.upsert({
            where: {
                organizationId
            },
            create: {
                organizationId,
                ...scalarData,
                sources: nextSources,
                sectors: nextSectors
            },
            update: {
                ...scalarData,
                sources: nextSources,
                sectors: nextSectors
            }
        });
        await new CreateAuditLogService().execute({
            organizationId,
            userId,
            entity: 'OrganizationPrintingSettings',
            entityId: settings.id,
            action: AuditAction.PRINTING_SETTINGS_UPDATED,
            description: 'Configuracoes de impressao atualizadas',
            metadata: {
                changedFields: Object.keys(data)
            }
        });
        return {
            settings,
            effective: toEffective(settings)
        };
    }
}
PrintingSettingsService.normalizeSources = normalizeSources;
PrintingSettingsService.normalizeSectors = normalizeSectors;
PrintingSettingsService.toEffective = toEffective;
