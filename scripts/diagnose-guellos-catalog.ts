import { prisma } from '../src/lib/prisma.js'
import { GetPublicStoreService } from '../src/modules/online-stores/services/get-public-store-service.js'

const slug = process.argv[2] ?? 'guellos-pizza'
const eventId = process.argv[3]

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const output = new Map<string, number>()
  for (const item of items) {
    const key = getKey(item)
    output.set(key, (output.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...output.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

async function main() {
  const store = await prisma.onlineStore.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      organizationId: true,
      active: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  })

  if (!store) {
    console.log(JSON.stringify({ slug, found: false }, null, 2))
    return
  }

  const [
    categories,
    products,
    inactiveProducts,
    mismatchedProducts,
    eventProducts
  ] = await Promise.all([
    prisma.catalogCategory.findMany({
      where: { organizationId: store.organizationId },
      select: {
        id: true,
        name: true,
        active: true,
        sortOrder: true
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    }),
    prisma.catalogProduct.findMany({
      where: { organizationId: store.organizationId },
      select: {
        id: true,
        name: true,
        catalogCategoryId: true,
        active: true,
        sortOrder: true,
        priceInCents: true,
        pricingRule: true,
        catalogCategory: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            active: true
          }
        }
      },
      orderBy: [
        { catalogCategory: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    }),
    prisma.catalogProduct.count({
      where: {
        organizationId: store.organizationId,
        active: false
      }
    }),
    prisma.catalogProduct.findMany({
      where: {
        organizationId: store.organizationId,
        catalogCategory: {
          organizationId: {
            not: store.organizationId
          }
        }
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        catalogCategoryId: true,
        catalogCategory: {
          select: {
            organizationId: true
          }
        }
      }
    }),
    eventId
      ? prisma.eventProduct.findMany({
          where: { eventId },
          select: {
            id: true,
            eventId: true,
            catalogProductId: true,
            active: true,
            soldOut: true,
            priceInCents: true,
            catalogProduct: {
              select: {
                id: true,
                name: true,
                organizationId: true,
                active: true,
                priceInCents: true
              }
            }
          }
        })
      : Promise.resolve([])
  ])

  const publicStore = await new GetPublicStoreService().execute({ slug })
  const publicCategories = publicStore.categories
  const publicProducts = publicCategories.flatMap(category =>
    (category.products ?? []).map(product => ({
      id: product.id,
      name: product.name,
      categoryId: category.id,
      categoryName: category.name
    }))
  )

  const activeProducts = products.filter(product => product.active)
  const visibleCandidates = products.filter(product => {
    return (
      product.active &&
      product.catalogCategory.active &&
      product.catalogCategory.name !== 'Itens do Combo'
    )
  })
  const returnedIds = new Set(publicProducts.map(product => product.id))

  const diagnostics = {
    slug,
    store: {
      id: store.id,
      name: store.name,
      organizationId: store.organizationId,
      active: store.active
    },
    organization: store.organization,
    totals: {
      categories: categories.length,
      activeCategories: categories.filter(category => category.active).length,
      products: products.length,
      activeProducts: activeProducts.length,
      inactiveProducts,
      publicCategories: publicCategories.length,
      publicProducts: publicProducts.length,
      eventProductLinks: eventProducts.length
    },
    productsByCategory: countBy(products, product => {
      return `${product.catalogCategory.name} (${product.catalogCategoryId})`
    }),
    activeProductsByCategory: countBy(activeProducts, product => {
      return `${product.catalogCategory.name} (${product.catalogCategoryId})`
    }),
    eventProducts: eventProducts.map(eventProduct => ({
      eventProductId: eventProduct.id,
      catalogProductId: eventProduct.catalogProductId,
      productName: eventProduct.catalogProduct.name,
      active: eventProduct.active,
      soldOut: eventProduct.soldOut,
      effectivePriceInCents:
        eventProduct.priceInCents ?? eventProduct.catalogProduct.priceInCents,
      productOrganizationId: eventProduct.catalogProduct.organizationId
    })),
    divergences: {
      catalogCategoryOrganizationMismatch: mismatchedProducts,
      visibleCandidatesMissingFromPublicRoute: visibleCandidates
        .filter(product => !returnedIds.has(product.id))
        .map(product => ({
          id: product.id,
          name: product.name,
          categoryName: product.catalogCategory.name,
          pricingRule: product.pricingRule
        }))
    }
  }

  console.log(JSON.stringify(diagnostics, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
