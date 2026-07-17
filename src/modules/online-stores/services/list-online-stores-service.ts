import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface ListOnlineStoresServiceRequest {
  organizationId: string
  userRole: UserRole
}

export class ListOnlineStoresService {
  async execute({ organizationId }: ListOnlineStoresServiceRequest) {
    const stores = await prisma.onlineStore.findMany({
      where: {
        organizationId
      },
      include: {
        organization: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return {
      stores
    }
  }
}
