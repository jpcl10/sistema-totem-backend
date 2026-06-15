import { prisma } from '../../../lib/prisma.js'

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
              slug: true,
              autoPrintEnabled: true,
              printingEnabled: true,
              printerPaperSize: true
            }
          }
        }
      })

    if (!device) {
      throw new Error('Device not found')
    }

    return {
      device,
      config: {
        eventId: device.eventId,
        eventSlug: device.event?.slug ?? null,
        eventName: device.event?.name ?? null,
        deviceCode: device.code,
        deviceName: device.name,
        deviceType: device.type,
        locationName: device.locationName,
        autoPrintEnabled:
          device.event?.autoPrintEnabled ??
          (
            device.type === 'SK210' ||
            device.type === 'PRINTER'
          ),
        printingEnabled:
          device.event?.printingEnabled ?? false,
        printerPaperSize:
          device.event?.printerPaperSize ?? '80mm'
      }
    }
  }
}