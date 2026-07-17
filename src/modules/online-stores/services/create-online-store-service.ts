import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface CreateOnlineStoreServiceRequest {
  organizationId: string
  userRole: UserRole
  name: string
  slug: string
  whatsapp: string
  city: string
  address?: string
  logoUrl?: string
  bannerUrl?: string
  isOpen?: boolean
  active?: boolean
}

export class CreateOnlineStoreService {
  async execute(request: CreateOnlineStoreServiceRequest) {
    // Check if organization has ONLINE_ORDERS module enabled
    const module = await prisma.organizationModule.findFirst({
      where: {
        organizationId: request.organizationId,
        moduleKey: 'ONLINE_ORDERS',
        enabled: true
      }
    })

    if (!module && request.userRole !== UserRole.SUPER_ADMIN) {
      throw new Error('Online orders module is not enabled for this organization')
    }

    // Check if slug is already taken
    const existingStore = await prisma.onlineStore.findUnique({
      where: { slug: request.slug }
    })

    if (existingStore) {
      throw new Error('Slug is already in use')
    }

    const store = await prisma.onlineStore.create({
      data: {
        organizationId: request.organizationId,
        name: request.name,
        slug: request.slug,
        whatsapp: request.whatsapp,
        city: request.city,
        address: request.address,
        logoUrl: request.logoUrl,
        bannerUrl: request.bannerUrl,
        isOpen: request.isOpen ?? true,
        active: request.active ?? true
      }
    })

    return {
      store
    }
  }
}
