import { Prisma } from '@prisma/client'

import {
  buildConfigurableCatalogOrderItems,
  isConfigurableOrderItemValidationError
} from '../../orders/services/configurable-order-item-builder.js'

type OnlineOrderItemInput = {
  catalogProductId: string
  quantity: number
  notes?: string | null
  selectedOptions?: {
    optionGroupId: string
    optionIds: string[]
  }[]
  selectedFlavorProductIds?: string[]
}

type BuildOnlineOrderItemsRequest = {
  tx: Prisma.TransactionClient
  organizationId: string
  items: OnlineOrderItemInput[]
}

export async function buildOnlineOrderItems(request: BuildOnlineOrderItemsRequest) {
  return buildConfigurableCatalogOrderItems(request)
}

export function isOnlineOrderItemValidationError(message: string) {
  return isConfigurableOrderItemValidationError(message)
}
