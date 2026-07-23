import { prisma } from '../../../lib/prisma.js';
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js';
function getPrintingSource(payload) {
    const data = typeof payload === 'object' && payload !== null
        ? payload
        : {};
    if (data.domain === 'ONLINE_ORDER') {
        return data.source === 'ADMIN'
            ? 'MANUAL_STORE'
            : 'ONLINE_STORE';
    }
    if (data.source === 'TOTEM') {
        return 'TOTEM';
    }
    if (data.source === 'MANUAL_EVENT' || data.manualSale === true) {
        return 'MANUAL_EVENT';
    }
    return 'EVENT';
}
function canAutoPrint(settings, source) {
    const sourceSettings = settings.sources[source];
    return Boolean(settings.printingEnabled &&
        settings.autoPrintEnabled &&
        sourceSettings?.enabled &&
        sourceSettings?.autoPrint);
}
export class ListPendingDevicePrintJobsService {
    async execute({ organizationId, eventId, storeId }) {
        const printJobs = await prisma.eventPrintJob.findMany({
            where: {
                status: 'PENDING',
                OR: [
                    {
                        event: {
                            organizationId
                        }
                    },
                    {
                        store: {
                            organizationId
                        }
                    }
                ],
                AND: [
                    {
                        OR: [
                            {
                                printer: {
                                    is: {
                                        active: true,
                                        connectionType: 'SK210_LOCAL'
                                    }
                                }
                            },
                            {
                                device: {
                                    is: {
                                        organizationId,
                                        status: 'ACTIVE'
                                    }
                                }
                            }
                        ]
                    }
                ],
                ...(eventId && {
                    eventId
                }),
                ...(storeId && {
                    storeId
                })
            },
            include: {
                printer: true,
                event: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                },
                store: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                },
                order: {
                    include: {
                        items: {
                            include: {
                                catalogProduct: {
                                    include: {
                                        catalogCategory: true
                                    }
                                }
                            }
                        }
                    }
                },
                onlineOrder: {
                    include: {
                        items: {
                            include: {
                                catalogProduct: {
                                    include: {
                                        catalogCategory: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            },
            take: 10
        });
        const filteredPrintJobs = [];
        for (const printJob of printJobs) {
            const effective = await new SettingsResolverService().execute({
                organizationId,
                eventId: printJob.eventId ?? undefined,
                storeId: printJob.storeId ?? undefined
            });
            if (canAutoPrint(effective.printing, getPrintingSource(printJob.payload))) {
                filteredPrintJobs.push(printJob);
            }
        }
        return {
            printJobs: filteredPrintJobs
        };
    }
}
