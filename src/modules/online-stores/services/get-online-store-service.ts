import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface GetOnlineStoreServiceRequest {
  id: string
  organizationId: string
  userRole: UserRole
}

export class GetOnlineStoreService {
  async execute({ id, organizationId }: GetOnlineStoreServiceRequest) {
    const store = await prisma.onlineStore.findFirst({
      where: {
        id,
        organizationId
      }
    })

    if (!store) {
      throw new Error('Store not found')
    }

    // Get catalog categories and products
    const [categories, products] = await Promise.all([
      prisma.catalogCategory.findMany({
        where: {
          organizationId: store.organizationId,
          active: true
        },
        orderBy: { name: 'asc' }
      }),
      prisma.catalogProduct.findMany({
        where: {
          organizationId: store.organizationId,
          active: true
        },
        orderBy: { name: 'asc' }
      })
    ])

    return {
      store: {
        ...store,
        categories,
        products
      }
    }
  }
}
