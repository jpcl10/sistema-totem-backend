import {
  DeviceAuthStatus,
  DeviceStatus,
  DeviceType,
  PaymentProvider
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { formatOptionGroups } from '../../catalog/event-products/services/event-product-presenter.js'
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'

interface ResolveTotemContextServiceRequest {
  deviceId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTotemV2Enabled(metadata: unknown) {
  const envEnabled =
    process.env.TOTEM_V2_ENABLED?.toLowerCase() === 'true'

  if (envEnabled) {
    return true
  }

  const record = isRecord(metadata) ? metadata : null
  return record?.uiVersion === 'V2'
}

export class ResolveTotemContextService {
  async execute({
    deviceId
  }: ResolveTotemContextServiceRequest) {
    const device =
      await prisma.device.findUnique({
        where: {
          id: deviceId
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          event: {
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
                orderBy: [
                  {
                    catalogProduct: {
                      catalogCategory: {
                        sortOrder: 'asc'
                      }
                    }
                  },
                  {
                    catalogProduct: {
                      sortOrder: 'asc'
                    }
                  },
                  {
                    catalogProduct: {
                      name: 'asc'
                    }
                  }
                ]
              }
            }
          },
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              bannerUrl: true
            }
          }
        }
      })

    if (!device) {
      throw new Error('Device not found')
    }

    if (device.type !== DeviceType.TOTEM) {
      throw new Error('Device is not a totem')
    }

    if (device.authStatus !== DeviceAuthStatus.ACTIVE) {
      throw new Error('Device not active')
    }

    if (device.status !== DeviceStatus.ACTIVE) {
      throw new Error('Device not allowed')
    }

    if (!isTotemV2Enabled(device.metadata)) {
      throw new Error('Totem V2 is not enabled for this device')
    }

    const contextType =
      device.eventId ? 'EVENT' : device.storeId ? 'ONLINE_STORE' : null

    if (!contextType) {
      throw new Error('Device has no totem context')
    }

    const paymentSettings =
      await new PaymentSettingsResolver().resolve({
        organizationId: device.organizationId,
        contextType,
        eventId: device.eventId,
        onlineStoreId: device.storeId
      })

    const effectiveSettings =
      await new SettingsResolverService().execute({
        organizationId: device.organizationId,
        eventId: device.eventId ?? undefined,
        storeId: device.storeId ?? undefined,
        deviceId: device.id
      })

    const mercadoPago =
      paymentSettings.providers.find(
        provider => provider.provider === PaymentProvider.MERCADO_PAGO
      )

    const paymentMethods = {
      pix:
        paymentSettings.methods.pix &&
        paymentSettings.defaultProvider === PaymentProvider.MERCADO_PAGO &&
        Boolean(mercadoPago?.active && mercadoPago.configured),
      card:
        paymentSettings.methods.credit ||
        paymentSettings.methods.debit
    }

    const categoriesMap = new Map<string, any>()

    if (device.event) {
      for (const eventProduct of device.event.eventProducts) {
        const product = eventProduct.catalogProduct
        const category = product.catalogCategory

        if (category && !category.active) {
          continue
        }

        const categoryId = category?.id ?? 'uncategorized'

        if (!categoriesMap.has(categoryId)) {
          categoriesMap.set(categoryId, {
            id: categoryId,
            name: category?.name ?? 'Outros',
            slug: category?.slug ?? 'outros',
            sortOrder: category?.sortOrder ?? 0,
            products: []
          })
        }

        categoriesMap.get(categoryId).products.push({
          id: eventProduct.id,
          catalogProductId: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          imageUrl: product.imageUrl,
          priceInCents:
            eventProduct.priceInCents ?? product.priceInCents,
          active: eventProduct.active,
          trackStock: eventProduct.trackStock,
          stockQuantity: eventProduct.stockQuantity,
          soldOut: eventProduct.soldOut,
          optionGroups: formatOptionGroups(product)
        })
      }
    }

    const displayName =
      device.event?.name ??
      device.store?.name ??
      device.organization.name

    const logoUrl =
      effectiveSettings.branding.logoUrl.value ??
      device.event?.logoUrl ??
      device.store?.logoUrl ??
      null

    const bannerUrl =
      effectiveSettings.branding.bannerUrl.value ??
      device.event?.bannerUrl ??
      device.store?.bannerUrl ??
      null

    return {
      deviceId: device.id,
      organizationId: device.organizationId,
      organizationSlug: device.organization.slug,
      contextType,
      eventId: device.eventId,
      eventSlug: device.event?.slug ?? null,
      storeId: device.storeId,
      storeSlug: device.store?.slug ?? null,
      displayName,
      bannerUrl,
      logoUrl,
      paymentMethods,
      printing: {
        enabled: effectiveSettings.printing.printingEnabled,
        autoPrintEnabled: effectiveSettings.printing.autoPrintEnabled,
        defaultPrinterDeviceId:
          effectiveSettings.printing.defaultPrinterDeviceId ?? null,
        paperSize: effectiveSettings.printing.paperSize
      },
      catalog: {
        categories: Array.from(categoriesMap.values())
      }
    }
  }
}
