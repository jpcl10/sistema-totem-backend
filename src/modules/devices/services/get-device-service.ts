import { prisma } from '../../../lib/prisma.js'

interface GetDeviceServiceRequest {
  organizationId: string
  deviceId: string
}

export class GetDeviceService {
  async execute({
    organizationId,
    deviceId
  }: GetDeviceServiceRequest) {
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        organizationId
      },
      include: {
        event: true
      }
    })

    if (!device) {
      throw new Error('Device not found')
    }

    return {
      device
    }
  }
}