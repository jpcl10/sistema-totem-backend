import {
  AuditAction,
  DeliveryFeeRuleType,
  OnlineOrderFulfillmentType,
  Prisma,
  SettingsChannel,
  SettingsContextType
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import {
  defaultOnlineStoreSettings,
  ensureStoreBelongsToOrganization,
  normalizeChannel,
  normalizeNeighborhood
} from './settings-shared.js'

type ActorRequest = {
  organizationId: string
  userId: string
}

type StoreRequest = {
  organizationId: string
  storeId: string
}

type UpdateOnlineOrderSettingsData = Partial<{
  onlineOrderingEnabled: boolean
  digitalMenuEnabled: boolean
  autoAcceptOrders: boolean
  minimumOrderInCents: number
  estimatedPreparationMinutes: number
  allowOrdersOutsideHours: boolean
  closedMessage: string | null
  checkoutNotice: string | null
  orderConfirmationMessage: string | null
  requireCustomerName: boolean
  requireCustomerPhone: boolean
  allowCustomerNotes: boolean
}>

type UpdateDeliverySettingsData = Partial<{
  deliveryEnabled: boolean
  pickupEnabled: boolean
  counterEnabled: boolean
  dineInEnabled: boolean
  allowOrdersOutsideHours: boolean
  estimatedDeliveryMinutes: number
  freeDeliveryAboveInCents: number | null
  defaultDeliveryFeeInCents: number
  requireDeliveryAddress: boolean
}>

type DeliveryFeeRuleInput = {
  storeId: string
  name: string
  type: DeliveryFeeRuleType
  neighborhood?: string | null
  feeInCents: number
  estimatedMinutes?: number | null
  minimumOrderInCents?: number | null
  freeDeliveryAboveInCents?: number | null
  active: boolean
  sortOrder: number
}

type DeliveryFeeRuleUpdate = Partial<Omit<DeliveryFeeRuleInput, 'storeId'>>

type ResolveStoreOperationRequest = StoreRequest & {
  channel?: SettingsChannel
  date?: Date
  fulfillmentType?: OnlineOrderFulfillmentType
  subtotalInCents?: number
  neighborhood?: string | null
}

function mergeSettings(settings: Partial<typeof defaultOnlineStoreSettings> | null | undefined) {
  return {
    ...defaultOnlineStoreSettings,
    ...settings
  }
}

function changedFields(data: Record<string, unknown>) {
  return Object.keys(data)
}

export class OnlineStoreSettingsService {
  async getOrDefaults({
    organizationId,
    storeId
  }: StoreRequest) {
    const store =
      await ensureStoreBelongsToOrganization(organizationId, storeId)

    const settings =
      await prisma.onlineStoreSettings.findUnique({
        where: {
          storeId
        }
      })

    return {
      store,
      settings,
      effective: mergeSettings(settings),
      source: settings ? 'ONLINE_STORE_SETTINGS' : 'DEFAULT'
    }
  }

  async updateOnlineOrders({
    organizationId,
    userId,
    storeId,
    data
  }: ActorRequest & StoreRequest & { data: UpdateOnlineOrderSettingsData }) {
    await ensureStoreBelongsToOrganization(organizationId, storeId)

    const settings =
      await prisma.onlineStoreSettings.upsert({
        where: {
          storeId
        },
        create: {
          organizationId,
          storeId,
          ...data
        },
        update: data
      })

    await new CreateAuditLogService().execute({
      organizationId,
      userId,
      entity: 'OnlineStoreSettings',
      entityId: settings.id,
      action: AuditAction.ONLINE_STORE_SETTINGS_UPDATED,
      description: 'Configuracoes de pedidos online atualizadas',
      metadata: {
        storeId,
        changedFields: changedFields(data)
      }
    })

    return {
      settings
    }
  }

  async updateDelivery({
    organizationId,
    userId,
    storeId,
    data
  }: ActorRequest & StoreRequest & { data: UpdateDeliverySettingsData }) {
    await ensureStoreBelongsToOrganization(organizationId, storeId)

    const settings =
      await prisma.onlineStoreSettings.upsert({
        where: {
          storeId
        },
        create: {
          organizationId,
          storeId,
          ...data
        },
        update: data
      })

    await new CreateAuditLogService().execute({
      organizationId,
      userId,
      entity: 'OnlineStoreSettings',
      entityId: settings.id,
      action: AuditAction.DELIVERY_SETTINGS_UPDATED,
      description: 'Configuracoes de delivery atualizadas',
      metadata: {
        storeId,
        changedFields: changedFields(data)
      }
    })

    return {
      settings
    }
  }

  async listDeliveryRules({
    organizationId,
    storeId
  }: StoreRequest) {
    await ensureStoreBelongsToOrganization(organizationId, storeId)

    const rules =
      await prisma.deliveryFeeRule.findMany({
        where: {
          organizationId,
          storeId
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      })

    return {
      rules
    }
  }

  async createDeliveryRule({
    organizationId,
    userId,
    data
  }: ActorRequest & { data: DeliveryFeeRuleInput }) {
    await ensureStoreBelongsToOrganization(organizationId, data.storeId)

    const rule =
      await prisma.deliveryFeeRule.create({
        data: {
          organizationId,
          storeId: data.storeId,
          name: data.name,
          type: data.type,
          neighborhood:
            data.type === DeliveryFeeRuleType.NEIGHBORHOOD
              ? data.neighborhood ?? null
              : null,
          feeInCents: data.feeInCents,
          estimatedMinutes: data.estimatedMinutes ?? null,
          minimumOrderInCents: data.minimumOrderInCents ?? null,
          freeDeliveryAboveInCents: data.freeDeliveryAboveInCents ?? null,
          active: data.active,
          sortOrder: data.sortOrder
        }
      })

    await new CreateAuditLogService().execute({
      organizationId,
      userId,
      entity: 'DeliveryFeeRule',
      entityId: rule.id,
      action: AuditAction.DELIVERY_FEE_RULE_CREATED,
      description: 'Regra de taxa de entrega criada',
      metadata: {
        storeId: rule.storeId,
        ruleId: rule.id,
        type: rule.type
      }
    })

    return {
      rule
    }
  }

  async updateDeliveryRule({
    organizationId,
    userId,
    ruleId,
    data
  }: ActorRequest & { ruleId: string; data: DeliveryFeeRuleUpdate }) {
    const current =
      await prisma.deliveryFeeRule.findFirst({
        where: {
          id: ruleId,
          organizationId
        }
      })

    if (!current) {
      throw new Error('Delivery fee rule not found')
    }

    const nextType =
      data.type ?? current.type

    const nextNeighborhood =
      data.neighborhood !== undefined
        ? data.neighborhood
        : current.neighborhood

    if (
      nextType === DeliveryFeeRuleType.NEIGHBORHOOD &&
      !nextNeighborhood
    ) {
      throw new Error('neighborhood is required for NEIGHBORHOOD delivery rules')
    }

    const rule =
      await prisma.deliveryFeeRule.update({
        where: {
          id: current.id
        },
        data: {
          ...data,
          neighborhood:
            nextType === DeliveryFeeRuleType.NEIGHBORHOOD
              ? nextNeighborhood
              : null
        }
      })

    await new CreateAuditLogService().execute({
      organizationId,
      userId,
      entity: 'DeliveryFeeRule',
      entityId: rule.id,
      action: AuditAction.DELIVERY_FEE_RULE_UPDATED,
      description: 'Regra de taxa de entrega atualizada',
      metadata: {
        storeId: rule.storeId,
        ruleId: rule.id,
        changedFields: changedFields(data)
      }
    })

    return {
      rule
    }
  }

  async deleteDeliveryRule({
    organizationId,
    userId,
    ruleId
  }: ActorRequest & { ruleId: string }) {
    const rule =
      await prisma.deliveryFeeRule.findFirst({
        where: {
          id: ruleId,
          organizationId
        }
      })

    if (!rule) {
      throw new Error('Delivery fee rule not found')
    }

    await prisma.deliveryFeeRule.delete({
      where: {
        id: rule.id
      }
    })

    await new CreateAuditLogService().execute({
      organizationId,
      userId,
      entity: 'DeliveryFeeRule',
      entityId: rule.id,
      action: AuditAction.DELIVERY_FEE_RULE_DELETED,
      description: 'Regra de taxa de entrega removida',
      metadata: {
        storeId: rule.storeId,
        ruleId: rule.id
      }
    })

    return {
      deleted: true
    }
  }

  async calculateDeliveryFee({
    organizationId,
    storeId,
    subtotalInCents,
    neighborhood
  }: StoreRequest & {
    subtotalInCents: number
    neighborhood?: string | null
  }) {
    const {
      effective
    } = await this.getOrDefaults({
      organizationId,
      storeId
    })

    const rules =
      await prisma.deliveryFeeRule.findMany({
        where: {
          organizationId,
          storeId,
          active: true
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ]
      })

    const normalizedNeighborhood =
      normalizeNeighborhood(neighborhood)

    const neighborhoodRules =
      rules.filter(rule => rule.type === DeliveryFeeRuleType.NEIGHBORHOOD)

    const matchedNeighborhoodRule =
      normalizedNeighborhood
        ? neighborhoodRules.find(rule =>
            normalizeNeighborhood(rule.neighborhood) === normalizedNeighborhood
          )
        : null

    if (neighborhoodRules.length > 0 && !matchedNeighborhoodRule) {
      throw new Error('Delivery neighborhood is not served')
    }

    const flatRule =
      rules.find(rule => rule.type === DeliveryFeeRuleType.FLAT)

    const rule =
      matchedNeighborhoodRule ?? flatRule ?? null

    const baseFee =
      rule?.feeInCents ?? effective.defaultDeliveryFeeInCents

    const freeDeliveryAbove =
      rule?.freeDeliveryAboveInCents ??
      effective.freeDeliveryAboveInCents

    const feeInCents =
      freeDeliveryAbove !== null &&
      subtotalInCents >= freeDeliveryAbove
        ? 0
        : baseFee

    return {
      feeInCents,
      rule,
      estimatedMinutes:
        rule?.estimatedMinutes ??
        effective.estimatedDeliveryMinutes,
      minimumOrderInCents:
        rule?.minimumOrderInCents ??
        effective.minimumOrderInCents,
      freeDeliveryAboveInCents: freeDeliveryAbove
    }
  }

  async resolveOperation({
    organizationId,
    storeId,
    channel,
    date,
    fulfillmentType,
    subtotalInCents,
    neighborhood
  }: ResolveStoreOperationRequest) {
    const store =
      await ensureStoreBelongsToOrganization(organizationId, storeId)

    if (!store) {
      throw new Error('Store not found')
    }

    const {
      settings,
      effective,
      source
    } = await this.getOrDefaults({
      organizationId,
      storeId
    })

    const normalizedChannel =
      normalizeChannel(channel)

    const resolvedDate =
      date ?? new Date()

    const resolvedDay =
      resolvedDate.getUTCDay()

    const resolvedDateOnly =
      new Date(Date.UTC(
        resolvedDate.getUTCFullYear(),
        resolvedDate.getUTCMonth(),
        resolvedDate.getUTCDate()
      ))

    const [
      storeException,
      organizationException,
      storeWeeklyHours,
      organizationWeeklyHours
    ] =
      await Promise.all([
        prisma.businessHourException.findFirst({
          where: {
            organizationId,
            storeId,
            channel: {
              in: [
                normalizedChannel,
                SettingsChannel.ALL
              ]
            },
            date: resolvedDateOnly
          },
          orderBy: {
            channel: 'desc'
          }
        }),
        prisma.businessHourException.findFirst({
          where: {
            organizationId,
            storeId: null,
            channel: {
              in: [
                normalizedChannel,
                SettingsChannel.ALL
              ]
            },
            date: resolvedDateOnly
          },
          orderBy: {
            channel: 'desc'
          }
        }),
        prisma.businessHour.findMany({
          where: {
            organizationId,
            contextType: SettingsContextType.ONLINE_STORE,
            storeId,
            channel: {
              in: [
                normalizedChannel,
                SettingsChannel.ALL
              ]
            },
            dayOfWeek: resolvedDay
          },
          orderBy: [
            { channel: 'desc' },
            { periodIndex: 'asc' }
          ]
        }),
        prisma.businessHour.findMany({
          where: {
            organizationId,
            contextType: SettingsContextType.ORGANIZATION,
            storeId: null,
            channel: {
              in: [
                normalizedChannel,
                SettingsChannel.ALL
              ]
            },
            dayOfWeek: resolvedDay
          },
          orderBy: [
            { channel: 'desc' },
            { periodIndex: 'asc' }
          ]
        })
      ])

    const exception =
      storeException ?? organizationException

    const weeklyHours =
      storeWeeklyHours.length > 0
        ? storeWeeklyHours
        : organizationWeeklyHours

    const nowMinutes =
      resolvedDate.getUTCHours() * 60 + resolvedDate.getUTCMinutes()

    const toMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + minutes
    }

    const scheduleOpen =
      exception
        ? exception.is24Hours || (
            !exception.isClosed &&
            exception.opensAt !== null &&
            exception.closesAt !== null &&
            nowMinutes >= toMinutes(exception.opensAt) &&
            nowMinutes < toMinutes(exception.closesAt)
          )
        : weeklyHours.length > 0
          ? weeklyHours.some(hour =>
              hour.is24Hours ||
              (
                !hour.isClosed &&
                nowMinutes >= toMinutes(hour.opensAt) &&
                nowMinutes < toMinutes(hour.closesAt)
              )
            )
          : true

    const scheduleSource =
      exception
        ? 'EXCEPTION'
        : storeWeeklyHours.length > 0
          ? 'STORE'
          : organizationWeeklyHours.length > 0
            ? 'ORGANIZATION'
          : 'DEFAULT'

    const openNow =
      store.active &&
      store.isOpen &&
      scheduleOpen

    const fulfillmentTypes: OnlineOrderFulfillmentType[] = []

    if (effective.deliveryEnabled) {
      fulfillmentTypes.push(OnlineOrderFulfillmentType.DELIVERY)
    }

    if (effective.pickupEnabled) {
      fulfillmentTypes.push(OnlineOrderFulfillmentType.PICKUP)
    }

    if (effective.counterEnabled) {
      fulfillmentTypes.push(OnlineOrderFulfillmentType.COUNTER)
    }

    if (effective.dineInEnabled) {
      fulfillmentTypes.push(OnlineOrderFulfillmentType.DINE_IN)
    }

    const requestedFulfillment =
      fulfillmentType ?? OnlineOrderFulfillmentType.DELIVERY

    let unavailableReason: string | null = null

    if (!store.active) {
      unavailableReason = 'STORE_INACTIVE'
    } else if (!effective.onlineOrderingEnabled) {
      unavailableReason = 'ONLINE_ORDERING_DISABLED'
    } else if (!store.isOpen) {
      unavailableReason = 'MANUALLY_CLOSED'
    } else if (!scheduleOpen && !effective.allowOrdersOutsideHours) {
      unavailableReason = 'OUTSIDE_BUSINESS_HOURS'
    } else if (!fulfillmentTypes.includes(requestedFulfillment)) {
      unavailableReason = `${requestedFulfillment}_DISABLED`
    }

    let deliveryQuote: Awaited<ReturnType<OnlineStoreSettingsService['calculateDeliveryFee']>> | null = null

    if (
      requestedFulfillment === OnlineOrderFulfillmentType.DELIVERY &&
      subtotalInCents !== undefined
    ) {
      deliveryQuote = await this.calculateDeliveryFee({
        organizationId,
        storeId,
        subtotalInCents,
        neighborhood
      })

      if (subtotalInCents < deliveryQuote.minimumOrderInCents) {
        unavailableReason = 'MINIMUM_ORDER_NOT_REACHED'
      }
    }

    if (
      requestedFulfillment !== OnlineOrderFulfillmentType.DELIVERY &&
      subtotalInCents !== undefined &&
      subtotalInCents < effective.minimumOrderInCents
    ) {
      unavailableReason = 'MINIMUM_ORDER_NOT_REACHED'
    }

    const acceptingOrders =
      unavailableReason === null &&
      effective.onlineOrderingEnabled &&
      (
        openNow ||
        effective.allowOrdersOutsideHours
      )

    return {
      store,
      settings,
      onlineOrders: {
        enabled: effective.onlineOrderingEnabled,
        digitalMenuEnabled: effective.digitalMenuEnabled,
        autoAccept: effective.autoAcceptOrders,
        minimumOrderInCents: effective.minimumOrderInCents,
        estimatedPreparationMinutes: effective.estimatedPreparationMinutes,
        allowOrdersOutsideHours: effective.allowOrdersOutsideHours,
        closedMessage: effective.closedMessage,
        checkoutNotice: effective.checkoutNotice,
        orderConfirmationMessage: effective.orderConfirmationMessage,
        requireCustomerName: effective.requireCustomerName,
        requireCustomerPhone: effective.requireCustomerPhone,
        allowCustomerNotes: effective.allowCustomerNotes
      },
      delivery: {
        enabled: effective.deliveryEnabled,
        pickupEnabled: effective.pickupEnabled,
        counterEnabled: effective.counterEnabled,
        dineInEnabled: effective.dineInEnabled,
        openNow,
        acceptingOrders,
        unavailableReason,
        defaultFeeInCents: effective.defaultDeliveryFeeInCents,
        freeDeliveryAboveInCents: effective.freeDeliveryAboveInCents,
        estimatedDeliveryMinutes: effective.estimatedDeliveryMinutes,
        requireDeliveryAddress: effective.requireDeliveryAddress,
        fulfillmentTypes,
        deliveryFeeRule: deliveryQuote?.rule ?? null,
        deliveryFeeInCents: deliveryQuote?.feeInCents ?? null,
        estimatedMinutes:
          requestedFulfillment === OnlineOrderFulfillmentType.DELIVERY
            ? deliveryQuote?.estimatedMinutes ?? effective.estimatedDeliveryMinutes
            : effective.estimatedPreparationMinutes
      },
      sources: {
        settings: source,
        manualOverride: 'ONLINE_STORE',
        schedule: scheduleSource,
        legacyFallback: settings ? null : 'ONLINE_STORE_DEFAULTS'
      }
    }
  }
}
