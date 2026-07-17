import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface UpdateOnlineStoreServiceRequest {
  id: string
  organizationId: string
  userRole: UserRole
  name?: string
  slug?: string
  whatsapp?: string
  city?: string
  address?: string | null
  logoUrl?: string | null
  bannerUrl?: string | null
  isOpen?: boolean
  active?: boolean
}

export class UpdateOnlineStoreService {
  async execute(request: UpdateOnlineStoreServiceRequest) {
    const store = await prisma.onlineStore.findFirst({
      where: {
        id: request.id,
        organizationId: request.organizationId
      }
    })

    if (!store) {
      throw new Error('Store not found')
    }

    // Check slug uniqueness if changing
    if (request.slug && request.slug !== store.slug) {
      const existingStore = await prisma.onlineStore.findUnique({
        where: { slug: request.slug }
      })
      if (existingStore) {
        throw new Error('Slug is already in use')
      }
    }

    const updatedStore = await prisma.onlineStore.update({
      where: { id: request.id },
      data: {
        name: request.name,
        slug: request.slug,
        whatsapp: request.whatsapp,
        city: request.city,
        address: request.address,
        logoUrl: request.logoUrl,
        bannerUrl: request.bannerUrl,
        isOpen: request.isOpen,
        active: request.active
      }
    })

    return {
      store: updatedStore
    }
  }
}
