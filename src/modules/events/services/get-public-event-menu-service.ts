import { SettingsChannel } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { formatOptionGroups } from '../../catalog/event-products/services/event-product-presenter.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'
import { resolveCanonicalPublicEvent } from './public-event-resolver.js'

interface GetPublicEventMenuServiceRequest {
  organizationSlug: string
  eventSlug: string
}

export class GetPublicEventMenuService {
  async execute({
    organizationSlug,
    eventSlug
  }: GetPublicEventMenuServiceRequest) {
    const resolvedEvent = await resolveCanonicalPublicEvent({
      organizationSlug,
      eventSlug
    })

    const event = await prisma.event.findFirst({
      where: {
        id: resolvedEvent.id,
        organizationId: resolvedEvent.organizationId,
        active: true
      },
      include: {
        organization: {
          select: {
            branding: {
              select: {
                updatedAt: true
              }
            }
          }
        },
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
        channel: SettingsChannel.TOTEM
      })

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
        optionGroups: any[]
      }[]
    }>()

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
      const categorySector = category?.sector ?? ''

      if (!categoriesMap.has(categoryId)) {
        categoriesMap.set(categoryId, {
          id: categoryId,
          name: categoryName,
          slug: categorySlug,
          sector: categorySector,
          products: []
        })
      }

      const effectivePriceInCents = eventProduct.priceInCents ?? product.priceInCents
      categoriesMap.get(categoryId)?.products.push({
        id: eventProduct.id,
        catalogProductId: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        imageUrl: product.imageUrl,
        priceInCents: effectivePriceInCents,
        trackStock: eventProduct.trackStock,
        stockQuantity: eventProduct.stockQuantity,
        soldOut: eventProduct.soldOut,
        active: eventProduct.active,
        optionGroups: formatOptionGroups(product)
      })
    }

    const categories = Array.from(categoriesMap.values())
      .filter(category => category.products.length > 0)
    const logoUrl =
      effective.branding.logoUrl.value ?? event.logoUrl
    const bannerUrl =
      effective.branding.bannerUrl.value ?? event.bannerUrl
    const brandingVersion = (
      event.organization.branding?.updatedAt ?? event.updatedAt
    ).toISOString()

    return {
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        organizationId: event.organizationId,
        organizationSlug: resolvedEvent.organizationSlug,
        canonicalPath: resolvedEvent.canonicalPath,
        canonicalUrl: resolvedEvent.canonicalUrl,

        primaryColor: effective.branding.primaryColor.value ?? event.primaryColor,
        secondaryColor: effective.branding.secondaryColor.value ?? event.secondaryColor,
        logoUrl,
        bannerUrl,

        branding: {
          logoUrl,
          bannerUrl,
          bannerMobileUrl: effective.branding.bannerMobileUrl.value,
          faviconUrl: effective.branding.faviconUrl.value,
          primaryColor: effective.branding.primaryColor.value ?? event.primaryColor,
          secondaryColor: effective.branding.secondaryColor.value ?? event.secondaryColor,
          backgroundColor: effective.branding.backgroundColor.value,
          theme: effective.branding.theme.value,
          defaultProductImageUrl: effective.branding.defaultProductImageUrl.value,
          updatedAt: brandingVersion
        },

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

        printingEnabled: effective.printing.printingEnabled,
        autoPrintEnabled: effective.printing.autoPrintEnabled,
        printMode: effective.printing.sources.TOTEM.printMode,
        printerPaperSize: effective.printing.paperSize,
        printing: effective.printing,

        categories
      }
    }
  }
}
