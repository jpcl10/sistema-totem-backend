import {
  SettingsChannel,
  SettingsContextType
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import {
  defaultGeneralSettings,
  defaultPrintingSettings,
  defaultPrintingSourceSettings,
  ensureStoreBelongsToOrganization,
  normalizeChannel,
  printingSources,
  sourceValue,
  toDateOnly
} from './settings-shared.js'
import { OnlineStoreSettingsService } from './online-store-settings-service.js'
import { PrintingSettingsService } from './printing-settings-service.js'

type SettingsResolverServiceRequest = {
  organizationId: string
  storeId?: string
  eventId?: string
  deviceId?: string
  channel?: SettingsChannel
  date?: Date
}

export class SettingsResolverService {
  async execute({
    organizationId,
    storeId,
    eventId,
    deviceId,
    channel,
    date
  }: SettingsResolverServiceRequest) {
    const normalizedChannel =
      normalizeChannel(channel)

    const [
      organization,
      settings,
      branding,
      printingSettings,
      store,
      event,
      device
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: {
          id: organizationId
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
      prisma.organizationPrintingSettings.findUnique({
        where: {
          organizationId
        }
      }),
      storeId
        ? ensureStoreBelongsToOrganization(organizationId, storeId)
        : Promise.resolve(null),
      eventId
        ? prisma.event.findFirst({
            where: {
              id: eventId,
              organizationId
            }
          })
        : Promise.resolve(null),
      deviceId
        ? prisma.device.findFirst({
            where: {
              id: deviceId,
              organizationId
            },
            include: {
              event: true,
              store: true
            }
          })
        : Promise.resolve(null)
    ])

    if (!organization) {
      throw new Error('Organization not found')
    }

    if (eventId && !event) {
      throw new Error('Event not found')
    }

    if (deviceId && !device) {
      throw new Error('Device not found')
    }

    const resolvedDate =
      toDateOnly(date ?? new Date())

    const [exception, weeklyHours, storeOperation] =
      await Promise.all([
        prisma.businessHourException.findFirst({
          where: {
            organizationId,
            storeId: store?.id ?? null,
            channel: {
              in: [
                normalizedChannel,
                SettingsChannel.ALL
              ]
            },
            date: resolvedDate
          },
          orderBy: {
            channel: 'desc'
          }
        }),
        prisma.businessHour.findMany({
          where: {
            organizationId,
            contextType: store
              ? SettingsContextType.ONLINE_STORE
              : SettingsContextType.ORGANIZATION,
            storeId: store?.id ?? null,
            channel: {
              in: [
                normalizedChannel,
                SettingsChannel.ALL
              ]
            },
            dayOfWeek: resolvedDate.getUTCDay()
          },
          orderBy: [
            {
              channel: 'desc'
            },
            {
              periodIndex: 'asc'
            }
          ]
        }),
        store
          ? new OnlineStoreSettingsService().resolveOperation({
              organizationId,
              storeId: store.id,
              channel: normalizedChannel,
              date: date ?? new Date()
            })
          : Promise.resolve(null)
      ])

    const businessHoursSource =
      exception
        ? 'EXCEPTION'
        : weeklyHours.length > 0
          ? store
            ? 'STORE'
            : 'ORGANIZATION'
          : 'DEFAULT'

    const legacyPrintingContext =
      event ?? device?.event ?? store ?? device?.store ?? null

    const legacyPrintMode =
      legacyPrintingContext &&
      'printMode' in legacyPrintingContext &&
      (
        legacyPrintingContext.printMode === 'FULL_ORDER' ||
        legacyPrintingContext.printMode === 'BY_SECTOR' ||
        legacyPrintingContext.printMode === 'BOTH'
      )
        ? legacyPrintingContext.printMode
        : defaultPrintingSourceSettings.printMode

    const legacyPrintingEnabled =
      legacyPrintingContext &&
      'printingEnabled' in legacyPrintingContext
        ? Boolean(legacyPrintingContext.printingEnabled)
        : defaultPrintingSettings.printingEnabled

    const legacyAutoPrintEnabled =
      legacyPrintingContext &&
      'autoPrintEnabled' in legacyPrintingContext
        ? Boolean(legacyPrintingContext.autoPrintEnabled)
        : defaultPrintingSettings.autoPrintEnabled

    const legacyPaperSize =
      legacyPrintingContext &&
      'printerPaperSize' in legacyPrintingContext &&
      typeof legacyPrintingContext.printerPaperSize === 'string'
        ? legacyPrintingContext.printerPaperSize
        : defaultPrintingSettings.paperSize

    const legacyPrintingFallback = {
      ...defaultPrintingSettings,
      printingEnabled: legacyPrintingEnabled,
      autoPrintEnabled: legacyAutoPrintEnabled,
      splitBySector:
        legacyPrintMode === 'BY_SECTOR' ||
        legacyPrintMode === 'BOTH',
      paperSize: legacyPaperSize,
      sources: Object.fromEntries(
        printingSources.map(source => [
          source,
          {
            ...defaultPrintingSourceSettings,
            enabled: legacyPrintingEnabled,
            autoPrint: legacyAutoPrintEnabled,
            printMode: legacyPrintMode
          }
        ])
      ),
      source: legacyPrintingContext ? 'LEGACY_FALLBACK' : 'DEFAULT',
      fallback: {
        used: Boolean(legacyPrintingContext),
        reason: legacyPrintingContext
          ? event
            ? 'EVENT_LEGACY'
            : store
              ? 'ONLINE_STORE_LEGACY'
              : device?.event
                ? 'DEVICE_EVENT_LEGACY'
                : device?.store
                  ? 'DEVICE_STORE_LEGACY'
                  : null
          : null
      }
    }

    const printing =
      printingSettings
        ? PrintingSettingsService.toEffective(printingSettings)
        : legacyPrintingFallback

    return {
      general: {
        legalName: sourceValue(settings?.legalName ?? null, settings?.legalName ? 'ORGANIZATION' : 'DEFAULT'),
        document: sourceValue(settings?.document ?? null, settings?.document ? 'ORGANIZATION' : 'DEFAULT'),
        contactEmail: sourceValue(settings?.contactEmail ?? null, settings?.contactEmail ? 'ORGANIZATION' : 'DEFAULT'),
        contactPhone: sourceValue(settings?.contactPhone ?? null, settings?.contactPhone ? 'ORGANIZATION' : 'DEFAULT'),
        whatsapp: sourceValue(settings?.whatsapp ?? null, settings?.whatsapp ? 'ORGANIZATION' : 'DEFAULT'),
        address: sourceValue(settings?.address ?? null, settings?.address ? 'ORGANIZATION' : 'DEFAULT'),
        city: sourceValue(settings?.city ?? null, settings?.city ? 'ORGANIZATION' : 'DEFAULT'),
        state: sourceValue(settings?.state ?? null, settings?.state ? 'ORGANIZATION' : 'DEFAULT'),
        postalCode: sourceValue(settings?.postalCode ?? null, settings?.postalCode ? 'ORGANIZATION' : 'DEFAULT'),
        timezone: sourceValue(settings?.timezone ?? defaultGeneralSettings.timezone, settings?.timezone ? 'ORGANIZATION' : 'DEFAULT'),
        locale: sourceValue(settings?.locale ?? defaultGeneralSettings.locale, settings?.locale ? 'ORGANIZATION' : 'DEFAULT'),
        currency: sourceValue(settings?.currency ?? defaultGeneralSettings.currency, settings?.currency ? 'ORGANIZATION' : 'DEFAULT')
      },
      branding: {
        logoUrl: sourceValue(event?.logoUrl ?? store?.logoUrl ?? branding?.logoUrl ?? branding?.lightLogoUrl ?? branding?.darkLogoUrl ?? null, event?.logoUrl ? 'EVENT_LEGACY' : store?.logoUrl ? 'STORE' : branding?.logoUrl || branding?.lightLogoUrl || branding?.darkLogoUrl ? 'ORGANIZATION' : 'DEFAULT'),
        bannerUrl: sourceValue(event?.bannerUrl ?? store?.bannerUrl ?? branding?.bannerDesktopUrl ?? null, event?.bannerUrl ? 'EVENT_LEGACY' : store?.bannerUrl ? 'STORE' : branding?.bannerDesktopUrl ? 'ORGANIZATION' : 'DEFAULT'),
        bannerMobileUrl: sourceValue(branding?.bannerMobileUrl ?? null, branding?.bannerMobileUrl ? 'ORGANIZATION' : 'DEFAULT'),
        faviconUrl: sourceValue(branding?.faviconUrl ?? null, branding?.faviconUrl ? 'ORGANIZATION' : 'DEFAULT'),
        primaryColor: sourceValue(event?.primaryColor ?? branding?.primaryColor ?? null, event?.primaryColor ? 'EVENT_LEGACY' : branding?.primaryColor ? 'ORGANIZATION' : 'DEFAULT'),
        secondaryColor: sourceValue(event?.secondaryColor ?? branding?.secondaryColor ?? null, event?.secondaryColor ? 'EVENT_LEGACY' : branding?.secondaryColor ? 'ORGANIZATION' : 'DEFAULT'),
        backgroundColor: sourceValue(branding?.backgroundColor ?? null, branding?.backgroundColor ? 'ORGANIZATION' : 'DEFAULT'),
        theme: sourceValue(branding?.theme ?? 'SYSTEM', branding?.theme ? 'ORGANIZATION' : 'DEFAULT'),
        defaultProductImageUrl: sourceValue(branding?.defaultProductImageUrl ?? null, branding?.defaultProductImageUrl ? 'ORGANIZATION' : 'DEFAULT')
      },
      businessHours: {
        date: resolvedDate,
        channel: normalizedChannel,
        exception,
        weeklyHours,
        source: businessHoursSource,
        manualOverride: store
          ? {
              isOpen: store.isOpen,
              source: 'STORE'
            }
          : null
      },
      onlineOrders: storeOperation
        ? {
            ...storeOperation.onlineOrders,
            source: storeOperation.sources.settings
          }
        : null,
      delivery: storeOperation
        ? {
            ...storeOperation.delivery,
            sources: storeOperation.sources
          }
        : null,
      printing,
      legacyAdapters: {
        event: event
          ? {
              id: event.id,
              name: event.name,
              slug: event.slug,
              source: 'EVENT_LEGACY'
            }
          : null,
        device: device
          ? {
              id: device.id,
              name: device.name,
              type: device.type,
              eventId: device.eventId,
              source: 'DEVICE_LEGACY'
            }
          : null,
        store: store
          ? {
              id: store.id,
              name: store.name,
              slug: store.slug,
              isOpen: store.isOpen,
              source: 'STORE'
            }
          : null
      }
    }
  }
}
