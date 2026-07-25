import { prisma } from '../../../lib/prisma.js'
import {
  catalogProductInclude,
  formatOptionGroups
} from '../../catalog/event-products/services/event-product-presenter.js'
import { shouldIncludeCatalogCategory } from '../../catalog/shared/catalog-visibility.js'

interface ListEventManualSaleCatalogServiceRequest {
  organizationId: string
  eventId: string
}

function formatCategory(category: any) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    sector: category.sector,
    sortOrder: category.sortOrder,
    active: category.active
  }
}

function formatManualSaleProduct(product: any, eventProduct: any | null) {
  const eventPriceInCents = eventProduct?.priceInCents ?? null
  const priceInCents = eventPriceInCents ?? product.priceInCents

  return {
    id: product.id,
    catalogProductId: product.id,
    eventProductId: eventProduct?.id ?? null,
    name: product.name,
    slug: product.slug,
    description: product.description,
    imageUrl: product.imageUrl,
    categoryId: product.catalogCategoryId,
    catalogCategoryId: product.catalogCategoryId,
    category: formatCategory(product.catalogCategory),
    catalogCategory: formatCategory(product.catalogCategory),
    catalogPriceInCents: product.priceInCents,
    eventPriceInCents,
    priceInCents,
    priceSource: eventPriceInCents === null ? 'CATALOG' : 'EVENT',
    pricingRule: product.pricingRule,
    supportsHalfAndHalf: product.supportsHalfAndHalf,
    canBeUsedAsFlavor: product.canBeUsedAsFlavor,
    halfAndHalfFlavorCategoryId: product.halfAndHalfFlavorCategoryId,
    active: product.active,
    eventProductActive: eventProduct?.active ?? null,
    soldOut: eventProduct?.soldOut ?? false,
    trackStock: eventProduct?.trackStock ?? false,
    stockQuantity: eventProduct?.stockQuantity ?? null,
    sortOrder: product.sortOrder,
    optionGroups: formatOptionGroups(product)
  }
}

export class ListEventManualSaleCatalogService {
  async execute({
    organizationId,
    eventId
  }: ListEventManualSaleCatalogServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      },
      select: {
        id: true,
        name: true,
        organizationId: true
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const [categories, products, eventProducts] = await Promise.all([
      prisma.catalogCategory.findMany({
        where: {
          organizationId,
          active: true
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      }),
      prisma.catalogProduct.findMany({
        where: {
          organizationId,
          active: true,
          catalogCategory: {
            organizationId,
            active: true
          }
        },
        include: catalogProductInclude(true),
        orderBy: [
          {
            catalogCategory: {
              sortOrder: 'asc'
            }
          },
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      }),
      prisma.eventProduct.findMany({
        where: {
          eventId
        }
      })
    ])

    const eventProductByCatalogProductId = new Map(
      eventProducts.map(eventProduct => [
        eventProduct.catalogProductId,
        eventProduct
      ])
    )

    const visibleProducts = products
      .filter(product => shouldIncludeCatalogCategory(product.catalogCategory))
      .map(product => ({
        product,
        eventProduct:
          eventProductByCatalogProductId.get(product.id) ?? null
      }))
      .filter(({ eventProduct }) => {
        if (!eventProduct) return true
        return eventProduct.active && !eventProduct.soldOut
      })
      .map(({ product, eventProduct }) =>
        formatManualSaleProduct(product, eventProduct)
      )

    return {
      event,
      categories: categories.filter(shouldIncludeCatalogCategory).map(formatCategory),
      products: visibleProducts
    }
  }
}
