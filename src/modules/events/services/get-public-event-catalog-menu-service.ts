import { SettingsChannel } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { formatOptionGroups } from '../../catalog/event-products/services/event-product-presenter.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'

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
            active: true,
            soldOut: false,
            OR: [
              {
                trackStock: false
              },
              {
                stockQuantity: null
              },
              {
                stockQuantity: {
                  gt: 0
                }
              }
            ],
            catalogProduct: {
              active: true
            }
          },
          include: {
            catalogProduct: {
              include: {
                catalogCategory: true,
                optionGroups: {
                  where: {
                    active: true
                  },
                  include: {
                    options: {
                      where: {
                        active: true
                      },
                      include: {
                        linkedProduct: true
                      },
                      orderBy: {
                        sortOrder: 'asc'
                      }
                    }
                  },
                  orderBy: {
                    sortOrder: 'asc'
                  }
                }
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

    const effective =
      await new SettingsResolverService().execute({
        organizationId: event.organizationId,
        eventId: event.id,
        channel: SettingsChannel.DIGITAL_MENU
      })

    const categoriesMap = new Map<string, any>()

    for (const eventProduct of event.eventProducts) {
      const product = eventProduct.catalogProduct
      const category = product.catalogCategory

      if (!product.active) {
        continue
      }

      // If product has category and category is inactive, skip
      if (category && !category.active) {
        continue
      }

      const categoryId = category?.id ?? 'uncategorized'
      const categoryName = category?.name ?? 'Outros'
      const categorySlug = category?.slug ?? 'outros'

      if (!categoriesMap.has(categoryId)) {
        categoriesMap.set(categoryId, {
          id: categoryId,
          name: categoryName,
          slug: categorySlug,
          products: []
        })
      }

      const effectivePriceInCents = eventProduct.priceInCents ?? product.priceInCents
      categoriesMap.get(categoryId).products.push({
        id: eventProduct.id,
        catalogProductId: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        imageUrl: product.imageUrl,
        priceInCents: effectivePriceInCents,
        active: eventProduct.active,
        trackStock: eventProduct.trackStock,
        stockQuantity: eventProduct.stockQuantity,
        soldOut: eventProduct.soldOut,
        optionGroups: formatOptionGroups(product)
      })
    }

    const logoUrl =
      effective.branding.logoUrl.value ?? event.logoUrl
    const bannerUrl =
      effective.branding.bannerUrl.value ?? event.bannerUrl

    return {
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        primaryColor: effective.branding.primaryColor.value ?? event.primaryColor,
        secondaryColor: effective.branding.secondaryColor.value ?? event.secondaryColor,
        logoUrl,
        branding: {
          logoUrl,
          bannerUrl,
          bannerMobileUrl: effective.branding.bannerMobileUrl.value,
          faviconUrl: effective.branding.faviconUrl.value,
          primaryColor: effective.branding.primaryColor.value ?? event.primaryColor,
          secondaryColor: effective.branding.secondaryColor.value ?? event.secondaryColor,
          backgroundColor: effective.branding.backgroundColor.value,
          theme: effective.branding.theme.value
        },
        categories: Array.from(categoriesMap.values())
      }
    }
  }
}
