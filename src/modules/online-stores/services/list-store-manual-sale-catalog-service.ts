import { prisma } from '../../../lib/prisma.js'
import {
  catalogProductInclude,
  formatOptionGroups
} from '../../catalog/event-products/services/event-product-presenter.js'

interface ListStoreManualSaleCatalogServiceRequest {
  organizationId: string
  storeId: string
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

function formatManualSaleProduct(product: any) {
  return {
    id: product.id,
    catalogProductId: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    imageUrl: product.imageUrl,
    categoryId: product.catalogCategoryId,
    catalogCategoryId: product.catalogCategoryId,
    category: formatCategory(product.catalogCategory),
    catalogCategory: formatCategory(product.catalogCategory),
    priceInCents: product.priceInCents,
    catalogPriceInCents: product.priceInCents,
    priceSource: 'CATALOG',
    pricingRule: product.pricingRule,
    supportsHalfAndHalf: product.supportsHalfAndHalf,
    canBeUsedAsFlavor: product.canBeUsedAsFlavor,
    halfAndHalfFlavorCategoryId: product.halfAndHalfFlavorCategoryId,
    active: product.active,
    sortOrder: product.sortOrder,
    optionGroups: formatOptionGroups(product)
  }
}

export class ListStoreManualSaleCatalogService {
  async execute({
    organizationId,
    storeId
  }: ListStoreManualSaleCatalogServiceRequest) {
    const store = await prisma.onlineStore.findFirst({
      where: {
        id: storeId,
        organizationId,
        active: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        organizationId: true
      }
    })

    if (!store) {
      throw new Error('Store not found')
    }

    const [categories, products] = await Promise.all([
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
      })
    ])

    return {
      store,
      categories: categories.map(formatCategory),
      products: products.map(formatManualSaleProduct)
    }
  }
}
