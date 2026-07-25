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

    const [categories, products] = await Promise.all([
      prisma.catalogCategory.findMany({
        where: {
          organizationId: store.organizationId,
          active: true
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      }),
      prisma.catalogProduct.findMany({
        where: {
          organizationId: store.organizationId,
          active: true,
          catalogCategory: {
            organizationId: store.organizationId,
            active: true
          }
        },
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
        },
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

    const formattedProducts = products.map(product => ({
      id: product.id,
      catalogProductId: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      imageUrl: product.imageUrl,
      priceInCents: product.priceInCents,
      pricingRule: product.pricingRule,
      supportsHalfAndHalf: product.supportsHalfAndHalf,
      canBeUsedAsFlavor: product.canBeUsedAsFlavor,
      halfAndHalfFlavorCategoryId: product.halfAndHalfFlavorCategoryId,
      categoryId: product.catalogCategoryId,
      catalogCategoryId: product.catalogCategoryId,
      category: product.catalogCategory,
      catalogCategory: product.catalogCategory,
      sortOrder: product.sortOrder,
      active: product.active,
      optionGroups: product.optionGroups.map(group => ({
        id: group.id,
        key: group.key,
        name: group.name,
        description: group.description,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
        active: group.active,
        options: group.options.map(option => ({
          id: option.id,
          key: option.key,
          name: option.name,
          description: option.description,
          priceDeltaInCents: option.priceDeltaInCents,
          linkedProductId: option.linkedProductId,
          sortOrder: option.sortOrder,
          active: option.active,
          linkedProduct: option.linkedProduct
            ? {
                id: option.linkedProduct.id,
                name: option.linkedProduct.name,
                imageUrl: option.linkedProduct.imageUrl
              }
            : null
        }))
      }))
    }))

    return {
      store: {
        ...store,
        categories,
        products: formattedProducts
      }
    }
  }
}
