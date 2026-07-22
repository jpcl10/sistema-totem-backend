import 'dotenv/config'
import { AuditAction, PrismaClient } from '@prisma/client'

// LEGACY MAINTENANCE SCRIPT.
// Do not use as a routine operational tool.
// This file exists only for historical reference and emergency recovery under explicit approval.
const prisma = new PrismaClient()

const FROM_ORG_ID = 'cmra0xvdh0000vwas3yfwzxi9'
const TO_ORG_ID = 'cmra0xvea000rvwasonliufxu'
const STORE_ID = 'cmra0xven000xvwashub9xwug'
const STORE_SLUG = 'guellos-pizza'

const DRY_RUN = process.env.DRY_RUN !== 'false'
const LEGACY_CONFIRMATION = process.env.ALLOW_LEGACY_TENANT_FIX

if (!DRY_RUN && LEGACY_CONFIRMATION !== 'I_UNDERSTAND_THIS_IS_DANGEROUS') {
  throw new Error(
    'Legacy tenant fix script refused to run without explicit confirmation.'
  )
}

type CorrectionContext = {
  categoryIds: string[]
  productIds: string[]
  optionGroupIds: string[]
  optionIds: string[]
  onlineOrderIds: string[]
  onlineOrderItemIds: string[]
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function collectContext(tx: PrismaClient): Promise<CorrectionContext> {
  const store = await tx.onlineStore.findUnique({
    where: {
      id: STORE_ID
    },
    select: {
      id: true,
      slug: true,
      organizationId: true
    }
  })

  assertCondition(store, 'Store guellos-pizza not found')
  assertCondition(store.slug === STORE_SLUG, 'Store slug mismatch')
  assertCondition(
    store.organizationId === FROM_ORG_ID,
    'Store is not currently in source organization'
  )

  const guellosExistingStore = await tx.onlineStore.findFirst({
    where: {
      slug: STORE_SLUG,
      organizationId: TO_ORG_ID,
      id: {
        not: STORE_ID
      }
    },
    select: {
      id: true
    }
  })

  assertCondition(
    !guellosExistingStore,
    'Target organization already has a different guellos-pizza store'
  )

  const guellosCategoryCount = await tx.catalogCategory.count({
    where: {
      organizationId: TO_ORG_ID
    }
  })

  const guellosProductCount = await tx.catalogProduct.count({
    where: {
      organizationId: TO_ORG_ID
    }
  })

  assertCondition(
    guellosCategoryCount === 0,
    `Target organization already has ${guellosCategoryCount} categories`
  )
  assertCondition(
    guellosProductCount === 0,
    `Target organization already has ${guellosProductCount} products`
  )

  const categories = await tx.catalogCategory.findMany({
    where: {
      organizationId: FROM_ORG_ID
    },
    select: {
      id: true,
      slug: true
    }
  })
  assertCondition(categories.length === 6, `Expected 6 categories, found ${categories.length}`)

  const categoryIds = categories.map(category => category.id)

  const categorySlugConflicts = await tx.catalogCategory.count({
    where: {
      organizationId: TO_ORG_ID,
      slug: {
        in: categories.map(category => category.slug)
      }
    }
  })
  assertCondition(categorySlugConflicts === 0, 'Target category slug conflict found')

  const products = await tx.catalogProduct.findMany({
    where: {
      organizationId: FROM_ORG_ID,
      catalogCategoryId: {
        in: categoryIds
      }
    },
    select: {
      id: true,
      slug: true
    }
  })
  assertCondition(products.length === 26, `Expected 26 products, found ${products.length}`)

  const productIds = products.map(product => product.id)

  const productSlugConflicts = await tx.catalogProduct.count({
    where: {
      organizationId: TO_ORG_ID,
      slug: {
        in: products.map(product => product.slug)
      }
    }
  })
  assertCondition(productSlugConflicts === 0, 'Target product slug conflict found')

  const optionGroups = await tx.catalogProductOptionGroup.findMany({
    where: {
      organizationId: FROM_ORG_ID,
      productId: {
        in: productIds
      }
    },
    select: {
      id: true
    }
  })
  assertCondition(
    optionGroups.length === 15,
    `Expected 15 option groups, found ${optionGroups.length}`
  )

  const optionGroupIds = optionGroups.map(group => group.id)

  const options = await tx.catalogProductOption.findMany({
    where: {
      organizationId: FROM_ORG_ID,
      optionGroupId: {
        in: optionGroupIds
      }
    },
    select: {
      id: true,
      linkedProductId: true
    }
  })
  assertCondition(options.length === 78, `Expected 78 options, found ${options.length}`)

  const optionIds = options.map(option => option.id)
  const linkedOptions = options.filter(option => option.linkedProductId)
  assertCondition(
    linkedOptions.length === 13,
    `Expected 13 linked options, found ${linkedOptions.length}`
  )

  for (const option of linkedOptions) {
    assertCondition(
      productIds.includes(option.linkedProductId as string),
      `Linked product ${option.linkedProductId} is outside moved product set`
    )
  }

  const onlineOrders = await tx.onlineOrder.findMany({
    where: {
      storeId: STORE_ID
    },
    select: {
      id: true
    }
  })
  assertCondition(
    onlineOrders.length === 5,
    `Expected 5 online orders, found ${onlineOrders.length}`
  )

  const onlineOrderIds = onlineOrders.map(order => order.id)

  const onlineOrderItems = await tx.onlineOrderItem.findMany({
    where: {
      orderId: {
        in: onlineOrderIds
      }
    },
    select: {
      id: true
    }
  })
  assertCondition(
    onlineOrderItems.length === 5,
    `Expected 5 online order items, found ${onlineOrderItems.length}`
  )

  const eventProducts = await tx.eventProduct.count({
    where: {
      catalogProductId: {
        in: productIds
      }
    }
  })
  assertCondition(eventProducts === 0, `Expected 0 event products, found ${eventProducts}`)

  return {
    categoryIds,
    productIds,
    optionGroupIds,
    optionIds,
    onlineOrderIds,
    onlineOrderItemIds: onlineOrderItems.map(item => item.id)
  }
}

async function validateAfter(tx: PrismaClient, context: CorrectionContext) {
  const store = await tx.onlineStore.findUnique({
    where: {
      id: STORE_ID
    },
    select: {
      organizationId: true
    }
  })

  assertCondition(store?.organizationId === TO_ORG_ID, 'Store was not moved to Guellos')

  const [
    guellosCategories,
    guellosProducts,
    guellosOptionGroups,
    guellosOptions,
    linkedOptions,
    onlineOrders,
    onlineOrderItems,
    zeStoreCount,
    zeMovedCategories,
    zeMovedProducts,
    orphanGroups,
    orphanOptions
  ] = await Promise.all([
    tx.catalogCategory.count({
      where: {
        id: {
          in: context.categoryIds
        },
        organizationId: TO_ORG_ID
      }
    }),
    tx.catalogProduct.count({
      where: {
        id: {
          in: context.productIds
        },
        organizationId: TO_ORG_ID,
        catalogCategoryId: {
          in: context.categoryIds
        }
      }
    }),
    tx.catalogProductOptionGroup.count({
      where: {
        id: {
          in: context.optionGroupIds
        },
        organizationId: TO_ORG_ID,
        productId: {
          in: context.productIds
        }
      }
    }),
    tx.catalogProductOption.count({
      where: {
        id: {
          in: context.optionIds
        },
        organizationId: TO_ORG_ID,
        optionGroupId: {
          in: context.optionGroupIds
        }
      }
    }),
    tx.catalogProductOption.count({
      where: {
        id: {
          in: context.optionIds
        },
        organizationId: TO_ORG_ID,
        linkedProductId: {
          in: context.productIds
        }
      }
    }),
    tx.onlineOrder.count({
      where: {
        id: {
          in: context.onlineOrderIds
        },
        storeId: STORE_ID
      }
    }),
    tx.onlineOrderItem.count({
      where: {
        id: {
          in: context.onlineOrderItemIds
        },
        orderId: {
          in: context.onlineOrderIds
        }
      }
    }),
    tx.onlineStore.count({
      where: {
        id: STORE_ID,
        slug: STORE_SLUG,
        organizationId: FROM_ORG_ID
      }
    }),
    tx.catalogCategory.count({
      where: {
        id: {
          in: context.categoryIds
        },
        organizationId: FROM_ORG_ID
      }
    }),
    tx.catalogProduct.count({
      where: {
        id: {
          in: context.productIds
        },
        organizationId: FROM_ORG_ID
      }
    }),
    tx.catalogProductOptionGroup.count({
      where: {
        id: {
          in: context.optionGroupIds
        },
        productId: {
          notIn: context.productIds
        }
      }
    }),
    tx.catalogProductOption.count({
      where: {
        id: {
          in: context.optionIds
        },
        optionGroupId: {
          notIn: context.optionGroupIds
        }
      }
    })
  ])

  assertCondition(guellosCategories === 6, `Post validation failed: ${guellosCategories} categories`)
  assertCondition(guellosProducts === 26, `Post validation failed: ${guellosProducts} products`)
  assertCondition(guellosOptionGroups === 15, `Post validation failed: ${guellosOptionGroups} option groups`)
  assertCondition(guellosOptions === 78, `Post validation failed: ${guellosOptions} options`)
  assertCondition(linkedOptions === 13, `Post validation failed: ${linkedOptions} linked options`)
  assertCondition(onlineOrders === 5, `Post validation failed: ${onlineOrders} online orders`)
  assertCondition(onlineOrderItems === 5, `Post validation failed: ${onlineOrderItems} online order items`)
  assertCondition(zeStoreCount === 0, 'Post validation failed: store still belongs to source org')
  assertCondition(zeMovedCategories === 0, 'Post validation failed: moved categories still in source org')
  assertCondition(zeMovedProducts === 0, 'Post validation failed: moved products still in source org')
  assertCondition(orphanGroups === 0, 'Post validation failed: orphan option groups')
  assertCondition(orphanOptions === 0, 'Post validation failed: orphan options')

  return {
    guellosCategories,
    guellosProducts,
    guellosOptionGroups,
    guellosOptions,
    linkedOptions,
    onlineOrders,
    onlineOrderItems,
    zeStoreCount,
    zeMovedCategories,
    zeMovedProducts
  }
}

async function main() {
  const report = await prisma.$transaction(async tx => {
    const context = await collectContext(tx as unknown as PrismaClient)

    const plannedUpdates = {
      onlineStore: 1,
      catalogCategories: context.categoryIds.length,
      catalogProducts: context.productIds.length,
      catalogProductOptionGroups: context.optionGroupIds.length,
      catalogProductOptions: context.optionIds.length,
      onlineOrders: 0,
      onlineOrderItems: 0
    }

    if (DRY_RUN) {
      return {
        dryRun: true,
        committed: false,
        plannedUpdates,
        context
      }
    }

    await tx.onlineStore.updateMany({
      where: {
        id: STORE_ID,
        organizationId: FROM_ORG_ID
      },
      data: {
        organizationId: TO_ORG_ID
      }
    })

    await tx.catalogCategory.updateMany({
      where: {
        id: {
          in: context.categoryIds
        },
        organizationId: FROM_ORG_ID
      },
      data: {
        organizationId: TO_ORG_ID
      }
    })

    await tx.catalogProduct.updateMany({
      where: {
        id: {
          in: context.productIds
        },
        organizationId: FROM_ORG_ID
      },
      data: {
        organizationId: TO_ORG_ID
      }
    })

    await tx.catalogProductOptionGroup.updateMany({
      where: {
        id: {
          in: context.optionGroupIds
        },
        organizationId: FROM_ORG_ID
      },
      data: {
        organizationId: TO_ORG_ID
      }
    })

    await tx.catalogProductOption.updateMany({
      where: {
        id: {
          in: context.optionIds
        },
        organizationId: FROM_ORG_ID
      },
      data: {
        organizationId: TO_ORG_ID
      }
    })

    const validation = await validateAfter(tx as unknown as PrismaClient, context)

    await tx.auditLog.create({
      data: {
        organizationId: TO_ORG_ID,
        userId: null,
        entity: 'TenantDataCorrection',
        entityId: STORE_ID,
        action: AuditAction.PRODUCT_UPDATED,
        description: 'Correção administrativa de tenant dos dados da Guellos',
        metadata: {
          type: 'TENANT_DATA_CORRECTION',
          reason: 'Guellos data imported while Zé do Facão tenant was active',
          fromOrganizationId: FROM_ORG_ID,
          toOrganizationId: TO_ORG_ID,
          storeId: STORE_ID,
          categoriesMoved: context.categoryIds.length,
          productsMoved: context.productIds.length,
          optionGroupsMoved: context.optionGroupIds.length,
          optionsMoved: context.optionIds.length,
          onlineOrdersPreserved: context.onlineOrderIds.length,
          onlineOrderItemsPreserved: context.onlineOrderItemIds.length
        }
      }
    })

    return {
      dryRun: false,
      committed: true,
      plannedUpdates,
      validation,
      context
    }
  })

  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
