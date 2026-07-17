import assert from 'node:assert/strict'

import { UserRole } from '@prisma/client'
import jwt from 'jsonwebtoken'

import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { SyncEventCatalogService } from '../src/modules/catalog/event-products/services/sync-event-catalog-service.js'
import { GetPublicEventMenuService } from '../src/modules/events/services/get-public-event-menu-service.js'

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const organizationSlug = `test-sync-event-catalog-${suffix}`
const eventSlug = `test-sync-event-catalog-event-${suffix}`
const userEmail = `test-sync-event-catalog-${suffix}@example.com`

async function cleanup(organizationId?: string) {
  if (!organizationId) {
    return
  }

  const events = await prisma.event.findMany({
    where: {
      organizationId
    },
    select: {
      id: true
    }
  })
  const eventIds = events.map(event => event.id)

  const products = await prisma.catalogProduct.findMany({
    where: {
      organizationId
    },
    select: {
      id: true
    }
  })
  const productIds = products.map(product => product.id)

  const groups = await prisma.catalogProductOptionGroup.findMany({
    where: {
      organizationId
    },
    select: {
      id: true
    }
  })
  const groupIds = groups.map(group => group.id)

  await prisma.auditLog.deleteMany({
    where: {
      organizationId
    }
  })
  await prisma.eventProduct.deleteMany({
    where: {
      eventId: {
        in: eventIds
      }
    }
  })
  await prisma.catalogProductOption.deleteMany({
    where: {
      optionGroupId: {
        in: groupIds
      }
    }
  })
  await prisma.catalogProductOptionGroup.deleteMany({
    where: {
      id: {
        in: groupIds
      }
    }
  })
  await prisma.catalogProduct.deleteMany({
    where: {
      id: {
        in: productIds
      }
    }
  })
  await prisma.catalogCategory.deleteMany({
    where: {
      organizationId
    }
  })
  await prisma.event.deleteMany({
    where: {
      id: {
        in: eventIds
      }
    }
  })
  await prisma.user.deleteMany({
    where: {
      organizationId
    }
  })
  await prisma.organization.delete({
    where: {
      id: organizationId
    }
  }).catch(() => undefined)
}

async function main() {
  process.env.JWT_SECRET ||= 'test-secret'

  let organizationId: string | undefined

  try {
    const organization = await prisma.organization.create({
      data: {
        name: 'Test Sync Event Catalog',
        slug: organizationSlug
      }
    })
    organizationId = organization.id

    const user = await prisma.user.create({
      data: {
        organizationId,
        name: 'Test Admin',
        email: userEmail,
        password: 'not-used',
        role: UserRole.ADMIN
      }
    })

    const event = await prisma.event.create({
      data: {
        organizationId,
        name: 'Test Event Catalog Sync',
        slug: eventSlug,
        active: true
      }
    })

    const [activeCategory, inactiveCategory, comboCategory] =
      await Promise.all([
        prisma.catalogCategory.create({
          data: {
            organizationId,
            name: 'Pizzas',
            slug: `pizzas-${suffix}`,
            active: true,
            sortOrder: 1
          }
        }),
        prisma.catalogCategory.create({
          data: {
            organizationId,
            name: 'Inativa',
            slug: `inativa-${suffix}`,
            active: false,
            sortOrder: 2
          }
        }),
        prisma.catalogCategory.create({
          data: {
            organizationId,
            name: 'Itens do Combo',
            slug: `itens-do-combo-${suffix}`,
            active: true,
            sortOrder: 3
          }
        })
      ])

    const inheritedPriceProduct = await prisma.catalogProduct.create({
      data: {
        organizationId,
        catalogCategoryId: activeCategory.id,
        name: 'Calabresa Teste',
        slug: `calabresa-teste-${suffix}`,
        priceInCents: 3000,
        active: true,
        sortOrder: 1
      }
    })

    const existingOverrideProduct = await prisma.catalogProduct.create({
      data: {
        organizationId,
        catalogCategoryId: activeCategory.id,
        name: 'Mussarela Override',
        slug: `mussarela-override-${suffix}`,
        priceInCents: 3500,
        active: true,
        sortOrder: 2
      }
    })

    const inactiveProduct = await prisma.catalogProduct.create({
      data: {
        organizationId,
        catalogCategoryId: activeCategory.id,
        name: 'Produto Inativo',
        slug: `produto-inativo-${suffix}`,
        priceInCents: 1000,
        active: false,
        sortOrder: 3
      }
    })

    const inactiveCategoryProduct = await prisma.catalogProduct.create({
      data: {
        organizationId,
        catalogCategoryId: inactiveCategory.id,
        name: 'Categoria Inativa',
        slug: `categoria-inativa-${suffix}`,
        priceInCents: 1100,
        active: true,
        sortOrder: 4
      }
    })

    const comboInternalProduct = await prisma.catalogProduct.create({
      data: {
        organizationId,
        catalogCategoryId: comboCategory.id,
        name: 'Produto Interno Combo',
        slug: `produto-interno-combo-${suffix}`,
        priceInCents: 1200,
        active: true,
        sortOrder: 5
      }
    })

    const optionGroup = await prisma.catalogProductOptionGroup.create({
      data: {
        organizationId,
        productId: inheritedPriceProduct.id,
        name: 'Bordas',
        key: `bordas-${suffix}`,
        required: false,
        minSelections: 0,
        maxSelections: 1,
        active: true,
        sortOrder: 1
      }
    })

    const option = await prisma.catalogProductOption.create({
      data: {
        organizationId,
        optionGroupId: optionGroup.id,
        name: 'Borda Vulcao',
        key: `borda-vulcao-${suffix}`,
        priceDeltaInCents: 1500,
        active: true,
        sortOrder: 1
      }
    })

    const existingEventProduct = await prisma.eventProduct.create({
      data: {
        eventId: event.id,
        catalogProductId: existingOverrideProduct.id,
        priceInCents: 4500,
        active: false,
        soldOut: true,
        trackStock: true,
        stockQuantity: 2
      }
    })

    const service = new SyncEventCatalogService()

    const dryRun = await service.execute({
      organizationId,
      userId: user.id,
      userRole: UserRole.ADMIN,
      eventId: event.id,
      dryRun: true
    })

    assert.equal(dryRun.dryRun, true)
    assert.equal(dryRun.totalCatalogProducts, 5)
    assert.equal(dryRun.alreadyLinked, 1)
    assert.equal(dryRun.wouldCreate, 1)
    assert.equal(dryRun.created, 0)
    assert.equal(dryRun.skipped, 3)

    const countAfterDryRun = await prisma.eventProduct.count({
      where: {
        eventId: event.id
      }
    })
    assert.equal(countAfterDryRun, 1)

    const token = jwt.sign(
      {
        role: user.role,
        organizationId
      },
      process.env.JWT_SECRET,
      {
        subject: user.id
      }
    )

    const routeDryRunResponse = await app.inject({
      method: 'POST',
      url: `/events/${event.id}/catalog/sync?dryRun=true`,
      headers: {
        authorization: `Bearer ${token}`
      }
    })
    assert.equal(routeDryRunResponse.statusCode, 200)
    assert.equal(routeDryRunResponse.json().wouldCreate, 1)

    const sync = await service.execute({
      organizationId,
      userId: user.id,
      userRole: UserRole.ADMIN,
      eventId: event.id,
      dryRun: false
    })

    assert.equal(sync.dryRun, false)
    assert.equal(sync.created, 1)
    assert.equal(sync.alreadyLinked, 1)
    assert.equal(sync.skipped, 3)

    const preservedExisting = await prisma.eventProduct.findUniqueOrThrow({
      where: {
        id: existingEventProduct.id
      }
    })
    assert.equal(preservedExisting.priceInCents, 4500)
    assert.equal(preservedExisting.active, false)
    assert.equal(preservedExisting.soldOut, true)
    assert.equal(preservedExisting.trackStock, true)
    assert.equal(preservedExisting.stockQuantity, 2)

    const createdEventProduct = await prisma.eventProduct.findFirstOrThrow({
      where: {
        eventId: event.id,
        catalogProductId: inheritedPriceProduct.id
      }
    })
    assert.equal(createdEventProduct.priceInCents, null)
    assert.equal(createdEventProduct.active, true)
    assert.equal(createdEventProduct.soldOut, false)
    assert.equal(createdEventProduct.trackStock, false)
    assert.equal(createdEventProduct.stockQuantity, null)

    const secondSync = await service.execute({
      organizationId,
      userId: user.id,
      userRole: UserRole.ADMIN,
      eventId: event.id,
      dryRun: false
    })
    assert.equal(secondSync.created, 0)
    assert.equal(secondSync.alreadyLinked, 2)

    const menu = await new GetPublicEventMenuService().execute({
      slug: event.slug
    })
    assert.equal(menu.event.categories.length, 1)
    assert.equal(menu.event.categories[0].products.length, 1)
    assert.equal(menu.event.categories[0].products[0].catalogProductId, inheritedPriceProduct.id)
    assert.equal(menu.event.categories[0].products[0].priceInCents, 3000)
    assert.equal(menu.event.categories[0].products[0].optionGroups[0].options[0].id, option.id)
    assert.equal(menu.event.categories[0].products[0].optionGroups[0].options[0].priceDeltaInCents, 1500)

    const skippedProductIds = new Set(
      sync.skippedItems.map(item => item.productId)
    )
    assert.equal(skippedProductIds.has(inactiveProduct.id), true)
    assert.equal(skippedProductIds.has(inactiveCategoryProduct.id), true)
    assert.equal(skippedProductIds.has(comboInternalProduct.id), true)

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        organizationId,
        eventId: event.id,
        entity: 'EventProduct'
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    assert.ok(auditLog)

    console.log(JSON.stringify({
      ok: true,
      dryRun: {
        totalCatalogProducts: dryRun.totalCatalogProducts,
        alreadyLinked: dryRun.alreadyLinked,
        wouldCreate: dryRun.wouldCreate,
        skipped: dryRun.skipped
      },
      sync: {
        created: sync.created,
        alreadyLinked: sync.alreadyLinked,
        skipped: sync.skipped
      },
      menu: {
        categories: menu.event.categories.length,
        products: menu.event.categories.reduce(
          (total, category) => total + category.products.length,
          0
        ),
        optionName: menu.event.categories[0].products[0].optionGroups[0].options[0].name
      }
    }, null, 2))
  } finally {
    await app.close()
    await cleanup(organizationId)
    await prisma.$disconnect()
  }
}

main().catch(async error => {
  await prisma.$disconnect()
  console.error(error)
  process.exit(1)
})
