import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface GetDeviceServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
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
        event: true,
        store: true
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
