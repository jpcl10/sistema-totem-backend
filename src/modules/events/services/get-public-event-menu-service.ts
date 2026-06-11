import { prisma } from '../../../lib/prisma.js'

interface GetPublicEventMenuServiceRequest {
  slug: string
}

export class GetPublicEventMenuService {
  async execute({
    slug
  }: GetPublicEventMenuServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        slug,
        active: true
      },
      include: {
        eventProducts: {
          where: {
            active: true,
            soldOut: false
          },
          include: {
            catalogProduct: {
              include: {
                catalogCategory: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const categoriesMap = new Map<string, {
      id: string
      name: string
      slug: string
      sector: string
      products: {
        id: string
        catalogProductId: string
        name: string
        slug: string
        description: string | null
        imageUrl: string | null
        priceInCents: number
        trackStock: boolean
        stockQuantity: number | null
        soldOut: boolean
        active: boolean
      }[]
    }>()

    for (const eventProduct of event.eventProducts) {
      const product = eventProduct.catalogProduct
      const category = product.catalogCategory

      if (!category.active || !product.active) {
        continue
      }

      if (!categoriesMap.has(category.id)) {
        categoriesMap.set(category.id, {
          id: category.id,
          name: category.name,
          slug: category.slug,
          sector: category.sector,
          products: []
        })
      }

      categoriesMap.get(category.id)?.products.push({
        id: eventProduct.id,
        catalogProductId: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        imageUrl: product.imageUrl,
        priceInCents: eventProduct.priceInCents,
        trackStock: eventProduct.trackStock,
        stockQuantity: eventProduct.stockQuantity,
        soldOut: eventProduct.soldOut,
        active: eventProduct.active
      })
    }

    const categories = Array.from(categoriesMap.values())
      .filter(category => category.products.length > 0)

    return {
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,

        primaryColor: event.primaryColor,
        secondaryColor: event.secondaryColor,
        logoUrl: event.logoUrl,
        bannerUrl: event.bannerUrl,

        totemWelcomeMessage: event.totemWelcomeMessage,
        totemBackgroundColor: event.totemBackgroundColor,
        totemTextColor: event.totemTextColor,

        totemShowPrices: event.totemShowPrices,
        totemShowLowStock: event.totemShowLowStock,
        totemRequireCustomerName: event.totemRequireCustomerName,
        totemAutoResetSeconds: event.totemAutoResetSeconds,
        totemShowLogo: event.totemShowLogo,
        totemFullscreenRecommended: event.totemFullscreenRecommended,

        pixEnabled: event.pixEnabled,
        pixKey: event.pixKey,
        pixReceiverName: event.pixReceiverName,
        pixCity: event.pixCity,
        pixInstructions: event.pixInstructions,

        printingEnabled: event.printingEnabled,
        autoPrintEnabled: event.autoPrintEnabled,
        printMode: event.printMode,
        printerPaperSize: event.printerPaperSize,

        categories
      }
    }
  }
}