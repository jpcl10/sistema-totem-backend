import { prisma } from '../../../lib/prisma.js'
import {
  getApiPublicUrl,
  buildPublicEventUrl,
  getFrontendUrl,
  getSocketPublicUrl
} from '../../../lib/public-urls.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'

interface GetDeviceConfigServiceRequest {
  deviceId: string
}

export class GetDeviceConfigService {
  async execute({
    deviceId
  }: GetDeviceConfigServiceRequest) {
    const device =
      await prisma.device.findUnique({
        where: {
          id: deviceId
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          organization: {
            select: {
              slug: true
            }
          },
          store: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })

    if (!device) {
      throw new Error('Device not found')
    }

    const effective =
      await new SettingsResolverService().execute({
        organizationId: device.organizationId,
        eventId: device.eventId ?? undefined,
        storeId: device.storeId ?? undefined,
        deviceId: device.id
      })
    const frontendUrl = getFrontendUrl()
    const apiPublicUrl = getApiPublicUrl()
    const socketPublicUrl = getSocketPublicUrl()
    const canonicalPublicUrl =
      device.event
        ? buildPublicEventUrl({
            organizationSlug: device.organization.slug,
            eventSlug: device.event.slug
          })
        : null

    return {
      device,
      config: {
        eventId: device.eventId,
        eventSlug: device.event?.slug ?? null,
        organizationSlug: device.organization.slug,
        canonicalPublicUrl,
        eventName: device.event?.name ?? null,
        storeId: device.storeId,
        storeSlug: device.store?.slug ?? null,
        storeName: device.store?.name ?? null,
        deviceCode: device.code,
        deviceName: device.name,
        deviceType: device.type,
        locationName: device.locationName,
        autoPrintEnabled: effective.printing.autoPrintEnabled,
        printingEnabled: effective.printing.printingEnabled,
        printerPaperSize: effective.printing.paperSize,
        printing: effective.printing,
        publicUrls: {
          apiBaseUrl: apiPublicUrl,
          socketUrl: socketPublicUrl,
          frontendUrl
        }
      }
    }
  }
}
