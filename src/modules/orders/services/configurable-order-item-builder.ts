import {
  CatalogProductPricingRule,
  Prisma
} from '@prisma/client'

type SelectedOptionInput = {
  optionGroupId: string
  optionIds: string[]
}

export type ConfigurableCatalogItemInput = {
  catalogProductId: string
  quantity: number
  notes?: string | null
  selectedOptions?: SelectedOptionInput[]
  selectedFlavorProductIds?: string[]
  basePriceInCents?: number
}

type BuildConfigurableCatalogItemsRequest = {
  tx: Prisma.TransactionClient
  organizationId: string
  items: ConfigurableCatalogItemInput[]
}

export const invalidConfigurableItemMessage =
  'Produto inv\u00e1lido ou indispon\u00edvel.'

function isDuplicate(values: string[]) {
  return new Set(values).size !== values.length
}

function validateSelectedOptions(selectedOptions: SelectedOptionInput[] = []) {
  const selectedOptionsMap = new Map<string, string[]>()

  for (const selected of selectedOptions) {
    if (selectedOptionsMap.has(selected.optionGroupId)) {
      throw new Error(`Grupo de op\u00e7\u00f5es duplicado: ${selected.optionGroupId}`)
    }

    if (isDuplicate(selected.optionIds)) {
      throw new Error(`Op\u00e7\u00f5es duplicadas no grupo: ${selected.optionGroupId}`)
    }

    selectedOptionsMap.set(selected.optionGroupId, selected.optionIds)
  }

  return selectedOptionsMap
}

export async function buildConfigurableCatalogOrderItems({
  tx,
  organizationId,
  items
}: BuildConfigurableCatalogItemsRequest) {
  const productIds = items.map(item => item.catalogProductId)
  const products = await tx.catalogProduct.findMany({
    where: {
      id: { in: productIds },
      organizationId,
      active: true
    },
    include: {
      optionGroups: {
        where: {
          active: true
        },
        include: {
          options: {
            where: {
              active: true
            }
          }
        }
      }
    }
  })

  const productMap = new Map(products.map(product => [product.id, product]))
  const allFlavorIds = items.flatMap(item => item.selectedFlavorProductIds ?? [])
  const flavorProducts = allFlavorIds.length > 0
    ? await tx.catalogProduct.findMany({
        where: {
          id: { in: allFlavorIds },
          organizationId,
          active: true
        }
      })
    : []
  const flavorMap = new Map(flavorProducts.map(product => [product.id, product]))

  const orderItemsData = []
  let subtotalInCents = 0

  for (const item of items) {
    const product = productMap.get(item.catalogProductId)

    if (!product) {
      throw new Error(invalidConfigurableItemMessage)
    }

    const selectedOptionsMap = validateSelectedOptions(item.selectedOptions)
    const optionSnapshots = []
    let optionsTotalDeltaInCents = 0

    for (const group of product.optionGroups) {
      const selectedOptionIds = selectedOptionsMap.get(group.id) || []

      if (group.required && selectedOptionIds.length === 0) {
        throw new Error(`O grupo de op\u00e7\u00f5es "${group.name}" \u00e9 obrigat\u00f3rio`)
      }

      if (selectedOptionIds.length < group.minSelections) {
        throw new Error(`O grupo de op\u00e7\u00f5es "${group.name}" requer pelo menos ${group.minSelections} sele\u00e7\u00f5es`)
      }

      if (selectedOptionIds.length > group.maxSelections) {
        throw new Error(`O grupo de op\u00e7\u00f5es "${group.name}" permite no m\u00e1ximo ${group.maxSelections} sele\u00e7\u00f5es`)
      }

      for (const optionId of selectedOptionIds) {
        const option = group.options.find(currentOption => currentOption.id === optionId)

        if (!option) {
          throw new Error(`Op\u00e7\u00e3o "${optionId}" n\u00e3o encontrada no grupo "${group.name}"`)
        }

        optionsTotalDeltaInCents += option.priceDeltaInCents

        let linkedProductName: string | null = null

        if (option.linkedProductId) {
          const linkedProduct = await tx.catalogProduct.findFirst({
            where: {
              id: option.linkedProductId,
              organizationId,
              active: true
            },
            select: {
              name: true
            }
          })

          if (linkedProduct) {
            linkedProductName = linkedProduct.name
          }
        }

        optionSnapshots.push({
          optionGroupId: group.id,
          optionId: option.id,
          linkedProductId: option.linkedProductId,
          groupName: group.name,
          optionName: linkedProductName || option.name,
          priceDeltaInCents: option.priceDeltaInCents
        })
      }

      selectedOptionsMap.delete(group.id)
    }

    if (selectedOptionsMap.size > 0) {
      const unknownGroupIds = Array.from(selectedOptionsMap.keys())
      throw new Error(`Grupos de op\u00e7\u00f5es desconhecidos: ${unknownGroupIds.join(', ')}`)
    }

    const selectedFlavorIds = item.selectedFlavorProductIds ?? []
    let basePriceInCents = item.basePriceInCents ?? product.priceInCents
    const flavorSnapshots = []

    if (product.pricingRule === CatalogProductPricingRule.MAX_SELECTED_FLAVOR) {
      if (selectedFlavorIds.length !== 2) {
        throw new Error('Selecione exatamente dois sabores para a pizza meio a meio.')
      }

      if (isDuplicate(selectedFlavorIds)) {
        throw new Error('Os dois sabores da pizza meio a meio devem ser diferentes.')
      }

      const flavors = selectedFlavorIds.map(id => flavorMap.get(id))

      if (flavors.some(flavor => !flavor)) {
        throw new Error('Sabor inv\u00e1lido ou indispon\u00edvel.')
      }

      const allowedFlavorCategoryId =
        product.halfAndHalfFlavorCategoryId ?? product.catalogCategoryId

      for (const flavor of flavors) {
        if (
          !flavor ||
          flavor.organizationId !== organizationId ||
          flavor.catalogCategoryId !== allowedFlavorCategoryId
        ) {
          throw new Error('Sabor inv\u00e1lido ou indispon\u00edvel.')
        }
      }

      basePriceInCents = Math.max(...flavors.map(flavor => flavor!.priceInCents))
      flavorSnapshots.push(...flavors.map((flavor, index) => ({
        catalogProductId: flavor!.id,
        position: index + 1,
        flavorName: flavor!.name,
        priceInCents: flavor!.priceInCents
      })))
    } else if (selectedFlavorIds.length > 0) {
      throw new Error('Este produto n\u00e3o aceita sele\u00e7\u00e3o de sabores.')
    }

    const unitPriceInCents = basePriceInCents + optionsTotalDeltaInCents
    const itemTotalInCents = unitPriceInCents * item.quantity
    subtotalInCents += itemTotalInCents

    orderItemsData.push({
      catalogProductId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPriceInCents,
      totalInCents: itemTotalInCents,
      notes: item.notes ?? undefined,
      options: {
        create: optionSnapshots
      },
      flavors: {
        create: flavorSnapshots
      }
    })
  }

  return {
    orderItemsData,
    subtotalInCents
  }
}

export function isConfigurableOrderItemValidationError(message: string) {
  return (
    message === invalidConfigurableItemMessage ||
    message === 'Sabor inv\u00e1lido ou indispon\u00edvel.' ||
    message === 'Selecione exatamente dois sabores para a pizza meio a meio.' ||
    message === 'Os dois sabores da pizza meio a meio devem ser diferentes.' ||
    message === 'Este produto n\u00e3o aceita sele\u00e7\u00e3o de sabores.' ||
    message.startsWith('Grupo de op\u00e7\u00f5es duplicado:') ||
    message.startsWith('Op\u00e7\u00f5es duplicadas no grupo:') ||
    message.startsWith('O grupo de op\u00e7\u00f5es "') ||
    message.startsWith('Op\u00e7\u00e3o "') ||
    message.startsWith('Grupos de op\u00e7\u00f5es desconhecidos:')
  )
}
