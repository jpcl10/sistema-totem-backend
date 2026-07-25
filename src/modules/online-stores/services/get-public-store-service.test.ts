import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../../../lib/prisma.js'
import { GetPublicStoreService } from './get-public-store-service.js'
import { OnlineStoreSettingsService } from '../../settings/services/online-store-settings-service.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'

function installMocks(overrides: {
  onlineStoreFindUnique?: (args: any) => Promise<any>
  catalogCategoryFindMany?: (args: any) => Promise<any>
  catalogProductFindMany?: (args: any) => Promise<any>
}) {
  const originals = {
    onlineStoreFindUnique: prisma.onlineStore.findUnique,
    catalogCategoryFindMany: prisma.catalogCategory.findMany,
    catalogProductFindMany: prisma.catalogProduct.findMany
  }

  ;(prisma.onlineStore.findUnique as any) = overrides.onlineStoreFindUnique ?? (async () => null)
  ;(prisma.catalogCategory.findMany as any) = overrides.catalogCategoryFindMany ?? (async () => [])
  ;(prisma.catalogProduct.findMany as any) = overrides.catalogProductFindMany ?? (async () => [])

  return () => {
    ;(prisma.onlineStore.findUnique as any) = originals.onlineStoreFindUnique
    ;(prisma.catalogCategory.findMany as any) = originals.catalogCategoryFindMany
    ;(prisma.catalogProduct.findMany as any) = originals.catalogProductFindMany
  }
}

test('excludes combo categories case-insensitively from the public store catalog', async () => {
  const restore = installMocks({
    onlineStoreFindUnique: async () => ({
      id: 'store-1',
      organizationId: 'org-1',
      slug: 'guellos-pizza',
      name: 'Guello\'s Pizza',
      whatsapp: '11999999999',
      city: 'São Paulo',
      address: 'Rua A',
      logoUrl: null,
      bannerUrl: null,
      active: true
    }),
    catalogCategoryFindMany: async () => [
      {
        id: 'cat-1',
        organizationId: 'org-1',
        name: 'Pizzas',
        slug: 'pizzas',
        active: true,
        sortOrder: 1
      },
      {
        id: 'cat-2',
        organizationId: 'org-1',
        name: 'itens do combo',
        slug: 'itens-do-combo',
        active: true,
        sortOrder: 2
      }
    ],
    catalogProductFindMany: async () => [
      {
        id: 'product-1',
        organizationId: 'org-1',
        active: true,
        catalogCategoryId: 'cat-1',
        priceInCents: 3500,
        pricingRule: 'STANDARD',
        supportsHalfAndHalf: false,
        canBeUsedAsFlavor: true,
        halfAndHalfFlavorCategoryId: null,
        sortOrder: 0,
        name: 'Pizza de Calabresa',
        slug: 'pizza-calabresa',
        description: null,
        imageUrl: null,
        catalogCategory: {
          id: 'cat-1',
          organizationId: 'org-1',
          name: 'Pizzas',
          slug: 'pizzas',
          active: true,
          sortOrder: 1
        },
        optionGroups: []
      },
      {
        id: 'product-2',
        organizationId: 'org-1',
        active: true,
        catalogCategoryId: 'cat-2',
        priceInCents: 4000,
        pricingRule: 'STANDARD',
        supportsHalfAndHalf: false,
        canBeUsedAsFlavor: true,
        halfAndHalfFlavorCategoryId: null,
        sortOrder: 0,
        name: 'Combo da Casa',
        slug: 'combo-da-casa',
        description: null,
        imageUrl: null,
        catalogCategory: {
          id: 'cat-2',
          organizationId: 'org-1',
          name: 'itens do combo',
          slug: 'itens-do-combo',
          active: true,
          sortOrder: 2
        },
        optionGroups: []
      }
    ]
  })

  const originalResolveOperation = OnlineStoreSettingsService.prototype.resolveOperation
  const originalExecute = SettingsResolverService.prototype.execute

  ;(OnlineStoreSettingsService.prototype.resolveOperation as any) = async () => ({
    availability: {
      isOpen: true,
      acceptingOrders: true,
      reason: null,
      nextOpeningAt: null,
      nextClosingAt: null,
      timezone: 'America/Sao_Paulo'
    },
    onlineOrders: {
      closedMessage: null,
      estimatedPreparationMinutes: 30,
      minimumOrderInCents: 0,
      allowOrdersOutsideHours: false,
      requireCustomerName: true,
      requireCustomerPhone: true,
      allowCustomerNotes: true
    },
    delivery: {
      enabled: true,
      pickupEnabled: true,
      counterEnabled: false,
      dineInEnabled: false,
      estimatedDeliveryMinutes: 30,
      freeDeliveryAboveInCents: 0,
      defaultFeeInCents: 0,
      requireDeliveryAddress: false,
      deliveryFeeInCents: 0,
      estimatedMinutes: 30,
      deliveryFeeRule: null,
      acceptOrderOutsideHours: false
    }
  })

  ;(SettingsResolverService.prototype.execute as any) = async () => ({
    branding: {
      logoUrl: { value: null },
      bannerUrl: { value: null },
      bannerMobileUrl: { value: null },
      faviconUrl: { value: null },
      primaryColor: { value: null },
      secondaryColor: { value: null },
      backgroundColor: { value: null },
      theme: { value: 'SYSTEM' }
    }
  })

  try {
    const result = await new GetPublicStoreService().execute({ slug: 'guellos-pizza' })

    assert.equal(result.categories.length, 1)
    assert.equal(result.categories[0].name, 'Pizzas')
    assert.equal(result.categories[0].products.length, 1)
    assert.equal(result.categories[0].products[0].id, 'product-1')
  } finally {
    restore()
    ;(OnlineStoreSettingsService.prototype.resolveOperation as any) = originalResolveOperation
    ;(SettingsResolverService.prototype.execute as any) = originalExecute
  }
})
