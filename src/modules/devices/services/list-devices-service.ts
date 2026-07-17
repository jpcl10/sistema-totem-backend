import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface ListDevicesServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
}

export class ListDevicesService {
  async execute({
    organizationId
  }: ListDevicesServiceRequest) {
    const devices = await prisma.device.findMany({
      where: {
        organizationId
      },
      include: {
        event: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      devices
    }
  }
}
