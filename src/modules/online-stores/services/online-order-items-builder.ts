import { Prisma } from '@prisma/client'

type OnlineOrderItemInput = {
  catalogProductId: string
  quantity: number
  notes?: string | null
  selectedOptions?: {
    optionGroupId: string
    optionIds: string[]
  }[]
}

type BuildOnlineOrderItemsRequest = {
  tx: Prisma.TransactionClient
  organizationId: string
  items: OnlineOrderItemInput[]
}

const invalidProductMessage = 'Produto inv\u00e1lido ou indispon\u00edvel.'

export async function buildOnlineOrderItems({
  tx,
  organizationId,
  items
}: BuildOnlineOrderItemsRequest) {
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
  const orderItemsData = []
  let subtotalInCents = 0

  for (const item of items) {
    const product = productMap.get(item.catalogProductId)

    if (!product) {
      throw new Error(invalidProductMessage)
    }

    const selectedOptionsMap = new Map<string, string[]>()

    for (const selected of item.selectedOptions ?? []) {
      if (selectedOptionsMap.has(selected.optionGroupId)) {
        throw new Error(`Grupo de op\u00e7\u00f5es duplicado: ${selected.optionGroupId}`)
      }

      if (new Set(selected.optionIds).size !== selected.optionIds.length) {
        throw new Error(`Op\u00e7\u00f5es duplicadas no grupo: ${selected.optionGroupId}`)
      }

      selectedOptionsMap.set(selected.optionGroupId, selected.optionIds)
    }

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

    const unitPriceInCents = product.priceInCents + optionsTotalDeltaInCents
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
      }
    })
  }

  return {
    orderItemsData,
    subtotalInCents
  }
}

export function isOnlineOrderItemValidationError(message: string) {
  return (
    message === invalidProductMessage ||
    message.startsWith('Grupo de op\u00e7\u00f5es duplicado:') ||
    message.startsWith('Op\u00e7\u00f5es duplicadas no grupo:') ||
    message.startsWith('O grupo de op\u00e7\u00f5es "') ||
    message.startsWith('Op\u00e7\u00e3o "') ||
    message.startsWith('Grupos de op\u00e7\u00f5es desconhecidos:')
  )
}
