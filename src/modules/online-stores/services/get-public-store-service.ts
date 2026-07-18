import { SettingsChannel } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { OnlineStoreSettingsService } from '../../settings/services/online-store-settings-service.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'

interface GetPublicStoreServiceRequest {
  slug: string
}

export class GetPublicStoreService {
  async execute({ slug }: GetPublicStoreServiceRequest) {
    const store = await prisma.onlineStore.findUnique({
      where: {
        slug,
        active: true
      }
    })

    if (!store) {
      throw new Error('Store not found')
    }

    // Get catalog categories and products from the organization!
    const [categories, products, operation, effective] = await Promise.all([
      prisma.catalogCategory.findMany({
        where: {
          organizationId: store.organizationId,
          active: true,
          NOT: {
          name: 'Itens do Combo'
        }
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      }),
      prisma.catalogProduct.findMany({
        where: {
          organizationId: store.organizationId,
          active: true
        },
        include: {
          catalogCategory: true,
          optionGroups: {
            where: { active: true },
            include: {
              options: {
                where: { active: true },
                include: {
                  linkedProduct: true
                },
                orderBy: { sortOrder: 'asc' }
              }
            },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      }),
      new OnlineStoreSettingsService().resolveOperation({
        organizationId: store.organizationId,
        storeId: store.id,
        channel: SettingsChannel.DIGITAL_MENU
      }),
      new SettingsResolverService().execute({
        organizationId: store.organizationId,
        storeId: store.id,
        channel: SettingsChannel.DIGITAL_MENU
      })
    ])

    // Build categories with nested products, excluding products from "Itens do Combo"
    const categoriesMap = new Map()
    for (const category of categories) {
      categoriesMap.set(category.id, {
        id: category.id,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        products: []
      })
    }

    for (const product of products) {
      // Skip products from "Itens do Combo"
      if (product.catalogCategory.name === 'Itens do Combo') {
        continue
      }
      if (product.pricingRule === 'MAX_SELECTED_FLAVOR') {
        continue
      }
      if (categoriesMap.has(product.catalogCategoryId)) {
        categoriesMap.get(product.catalogCategoryId)?.products.push({
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          imageUrl: product.imageUrl,
          priceInCents: product.priceInCents,
          pricingRule: product.pricingRule,
          supportsHalfAndHalf: product.supportsHalfAndHalf,
          acceptsHalfAndHalf: product.supportsHalfAndHalf,
          halfAndHalfFlavorCategoryId: product.halfAndHalfFlavorCategoryId,
          halfAndHalfFlavors:
            product.supportsHalfAndHalf
              ? products
                  .filter(flavor =>
                    flavor.active &&
                    flavor.canBeUsedAsFlavor &&
                    flavor.pricingRule !== 'MAX_SELECTED_FLAVOR' &&
                    (
                      flavor.catalogCategoryId ===
                      (product.halfAndHalfFlavorCategoryId ?? product.catalogCategoryId)
                    )
                  )
                  .map(flavor => ({
                    id: flavor.id,
                    name: flavor.name,
                    description: flavor.description,
                    imageUrl: flavor.imageUrl,
                    priceInCents: flavor.priceInCents,
                    categoryId: flavor.catalogCategoryId
                  }))
              : [],
          halfAndHalfFlavorProducts: [],
          sortOrder: product.sortOrder,
          optionGroups: product.optionGroups.map(group => ({
            id: group.id,
            name: group.name,
            description: group.description,
            required: group.required,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: group.sortOrder,
            options: group.options.map(option => ({
              id: option.id,
              name: option.name,
              description: option.description,
              priceDeltaInCents: option.priceDeltaInCents,
              linkedProductId: option.linkedProductId,
              sortOrder: option.sortOrder,
              linkedProduct: option.linkedProduct ? {
                id: option.linkedProduct.id,
                name: option.linkedProduct.name,
                imageUrl: option.linkedProduct.imageUrl
              } : null
            }))
          }))
        })
      }
    }

    const finalCategories = Array.from(categoriesMap.values())
    const logoUrl =
      effective.branding.logoUrl.value ?? store.logoUrl
    const bannerUrl =
      effective.branding.bannerUrl.value ?? store.bannerUrl

    return {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        whatsapp: store.whatsapp,
        city: store.city,
        address: store.address,
        logoUrl,
        bannerUrl,
        isOpen: operation.availability.isOpen,
        acceptingOrders: operation.availability.acceptingOrders,
        availabilityReason: operation.availability.reason,
        nextOpeningAt: operation.availability.nextOpeningAt,
        nextClosingAt: operation.availability.nextClosingAt
      },
      branding: {
        logoUrl,
        bannerUrl,
        bannerMobileUrl: effective.branding.bannerMobileUrl.value,
        faviconUrl: effective.branding.faviconUrl.value,
        primaryColor: effective.branding.primaryColor.value,
        secondaryColor: effective.branding.secondaryColor.value,
        backgroundColor: effective.branding.backgroundColor.value,
        theme: effective.branding.theme.value
      },
      operation: {
        openNow: operation.availability.isOpen,
        acceptingOrders: operation.availability.acceptingOrders,
        statusMessage:
          operation.availability.acceptingOrders
            ? 'Aberto agora'
            : operation.onlineOrders.closedMessage ?? 'Fechado no momento',
        unavailableReason: operation.availability.reason,
        availabilityReason: operation.availability.reason,
        timezone: operation.availability.timezone,
        nextOpeningAt: operation.availability.nextOpeningAt,
        nextClosingAt: operation.availability.nextClosingAt,
        estimatedPreparationMinutes:
          operation.onlineOrders.estimatedPreparationMinutes,
        estimatedDeliveryMinutes:
          operation.delivery.estimatedDeliveryMinutes
      },
      fulfillment: {
        deliveryEnabled: operation.delivery.enabled,
        pickupEnabled: operation.delivery.pickupEnabled,
        counterEnabled: operation.delivery.counterEnabled,
        dineInEnabled: operation.delivery.dineInEnabled
      },
      orderRules: {
        minimumOrderInCents: operation.onlineOrders.minimumOrderInCents,
        freeDeliveryAboveInCents: operation.delivery.freeDeliveryAboveInCents,
        defaultDeliveryFeeInCents: operation.delivery.defaultFeeInCents,
        allowOrdersOutsideHours:
          operation.onlineOrders.allowOrdersOutsideHours,
        checkoutNotice: operation.onlineOrders.checkoutNotice,
        requireCustomerName: operation.onlineOrders.requireCustomerName,
        requireCustomerPhone: operation.onlineOrders.requireCustomerPhone,
        requireDeliveryAddress: operation.delivery.requireDeliveryAddress,
        allowCustomerNotes: operation.onlineOrders.allowCustomerNotes
      },
      categories: finalCategories
    }
  }
}
