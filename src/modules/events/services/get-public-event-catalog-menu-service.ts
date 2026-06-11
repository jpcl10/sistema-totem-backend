import { prisma } from '../../../lib/prisma.js'

interface GetPublicEventCatalogMenuServiceRequest {
  slug: string
}

export class GetPublicEventCatalogMenuService {
  async execute({
    slug
  }: GetPublicEventCatalogMenuServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        slug,
        active: true
      },
      include: {
        eventProducts: {
          where: {
            active: true
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

    const categoriesMap = new Map<string, any>()

    for (const eventProduct of event.eventProducts) {
      const product = eventProduct.catalogProduct
      const category = product.catalogCategory

      if (!categoriesMap.has(category.id)) {
        categoriesMap.set(category.id, {
          id: category.id,
          name: category.name,
          slug: category.slug,
          products: []
        })
      }

      categoriesMap.get(category.id).products.push({
        id: eventProduct.id,
        catalogProductId: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        imageUrl: product.imageUrl,
        priceInCents: eventProduct.priceInCents,
        active: eventProduct.active
      })
    }

    return {
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        primaryColor: event.primaryColor,
        secondaryColor: event.secondaryColor,
        logoUrl: event.logoUrl,
        categories: Array.from(categoriesMap.values())
      }
    }
  }
}