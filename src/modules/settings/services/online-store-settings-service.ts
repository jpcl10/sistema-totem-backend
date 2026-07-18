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

const DEFAULT_TIMEZONE = 'America/Sao_Paulo'
const MINUTES_IN_DAY = 24 * 60

type ManualOverrideMode = 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED'

type TimeWindow = {
  dayOfWeek: number
  opensAt: string
  closesAt: string
  isClosed: boolean
  is24Hours: boolean
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)

  const pick = (type: string) =>
    Number(parts.find(part => part.type === type)?.value)

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute')
  }
}

function zonedDayOfWeek(date: Date, timezone: string) {
  const { year, month, day } = zonedParts(date, timezone)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function zonedDateOnly(date: Date, timezone: string) {
  const { year, month, day } = zonedParts(date, timezone)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function localDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function zonedLocalDateTimeToUtc(date: Date, time: string, timezone: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const target = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hours,
    minutes
  )

  let candidate = new Date(target)

  for (let attempt = 0; attempt < 2; attempt++) {
    const observed = zonedParts(candidate, timezone)
    const observedLocal = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute
    )
    candidate = new Date(candidate.getTime() + target - observedLocal)
  }

  return candidate
}

function windowContainsNow(window: TimeWindow, nowMinutes: number, fromPreviousDay = false) {
  if (window.isClosed) {
    return false
  }

  if (window.is24Hours) {
    return true
  }

  const opens = toMinutes(window.opensAt)
  const closes = toMinutes(window.closesAt)

  if (opens === closes) {
    return false
  }

  if (opens < closes) {
    return !fromPreviousDay && nowMinutes >= opens && nowMinutes < closes
  }

  return fromPreviousDay
    ? nowMinutes < closes
    : nowMinutes >= opens
}

function scheduleIsOpen(windows: TimeWindow[], dayOfWeek: number, previousDay: number, nowMinutes: number) {
  return windows.some(window => {
    if (window.dayOfWeek === dayOfWeek) {
      return windowContainsNow(window, nowMinutes)
    }

    if (window.dayOfWeek === previousDay) {
      return windowContainsNow(window, nowMinutes, true)
    }

    return false
  })
}

function nextOpeningAt(
  weeklyWindows: TimeWindow[],
  localDate: Date,
  dayOfWeek: number,
  nowMinutes: number,
  timezone: string,
  futureWindowsForDate?: (date: Date, dayOfWeek: number) => TimeWindow[] | null
) {
  for (let offset = 0; offset < 8; offset++) {
    const candidateDay = (dayOfWeek + offset) % 7
    const candidateDate =
      addDays(localDate, offset)
    const candidateWindows =
      futureWindowsForDate?.(candidateDate, candidateDay)
    const dayWindows = (candidateWindows ?? weeklyWindows)
      .filter(window => window.dayOfWeek === candidateDay && !window.isClosed)
      .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt))

    for (const window of dayWindows) {
      const opens = window.is24Hours ? 0 : toMinutes(window.opensAt)
      if (offset > 0 || opens > nowMinutes) {
        return zonedLocalDateTimeToUtc(
          candidateDate,
          window.is24Hours ? '00:00' : window.opensAt,
          timezone
        ).toISOString()
      }
    }
  }

  return null
}

function nextClosingAt(windows: TimeWindow[], localDate: Date, dayOfWeek: number, previousDay: number, nowMinutes: number, timezone: string) {
  const active = windows.find(window => {
    if (window.dayOfWeek === dayOfWeek) {
      return windowContainsNow(window, nowMinutes)
    }

    if (window.dayOfWeek === previousDay) {
      return windowContainsNow(window, nowMinutes, true)
    }

    return false
  })

  if (!active || active.is24Hours || active.isClosed) {
    return null
  }

  const opens = toMinutes(active.opensAt)
  const closes = toMinutes(active.closesAt)
  const closeDate =
    active.dayOfWeek === previousDay
      ? localDate
      : closes <= opens
      ? addDays(localDate, 1)
      : localDate

  return zonedLocalDateTimeToUtc(closeDate, active.closesAt, timezone).toISOString()
}

function pickScopedException<T extends {
  storeId: string | null
  channel: SettingsChannel
}>(exceptions: T[], storeId: string, channel: SettingsChannel) {
  return exceptions.find(exception =>
    exception.storeId === storeId &&
    exception.channel === channel
  ) ??
    exceptions.find(exception =>
      exception.storeId === storeId &&
      exception.channel === SettingsChannel.ALL
    ) ??
    exceptions.find(exception =>
      exception.storeId === null &&
      exception.channel === channel
    ) ??
    exceptions.find(exception =>
      exception.storeId === null &&
      exception.channel === SettingsChannel.ALL
    ) ??
    null
}

function exceptionToWindow(
  exception: {
    opensAt: string | null
    closesAt: string | null
    isClosed: boolean
    is24Hours: boolean
  },
  dayOfWeek: number
): TimeWindow[] {
  if (exception.isClosed) {
    return []
  }

  return [{
    dayOfWeek,
    opensAt: exception.opensAt ?? '00:00',
    closesAt: exception.closesAt ?? '23:59',
    isClosed: exception.isClosed,
    is24Hours: exception.is24Hours
  }]
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

    const organizationSettings =
      await prisma.organizationSettings.findUnique({
        where: {
          organizationId
        },
        select: {
          timezone: true
        }
      })

    const timezone =
      organizationSettings?.timezone ?? DEFAULT_TIMEZONE

    const localDate =
      zonedDateOnly(resolvedDate, timezone)

    const resolvedDay =
      zonedDayOfWeek(resolvedDate, timezone)

    const previousDay =
      (resolvedDay + 6) % 7

    const nowLocal =
      zonedParts(resolvedDate, timezone)

    const nowMinutes =
      nowLocal.hour * 60 + nowLocal.minute

    const futureLimitDate =
      addDays(localDate, 8)

    const [
      exceptions,
      storeWeeklyHours,
      organizationWeeklyHours
    ] =
      await Promise.all([
        prisma.businessHourException.findMany({
          where: {
            organizationId,
            OR: [
              { storeId },
              { storeId: null }
            ],
            channel: {
              in: [
                normalizedChannel,
                SettingsChannel.ALL
              ]
            },
            date: {
              gte: localDate,
              lt: futureLimitDate
            }
          },
          orderBy: [
            { date: 'asc' },
            { storeId: 'desc' },
            { channel: 'desc' }
          ]
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
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
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
            }
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { channel: 'desc' },
            { periodIndex: 'asc' }
          ]
        })
      ])

    const todayException =
      pickScopedException(
        exceptions.filter(exception =>
          localDateKey(exception.date) === localDateKey(localDate)
        ),
        storeId,
        normalizedChannel
      )

    const exception =
      todayException

    const weeklyHours =
      storeWeeklyHours.length > 0
        ? storeWeeklyHours
        : organizationWeeklyHours

    const weeklyWindows: TimeWindow[] =
      weeklyHours.map(hour => ({
        dayOfWeek: hour.dayOfWeek,
        opensAt: hour.opensAt,
        closesAt: hour.closesAt,
        isClosed: hour.isClosed,
        is24Hours: hour.is24Hours
      }))

    const windows: TimeWindow[] =
      exception
        ? [
            ...weeklyWindows.filter(window =>
              window.dayOfWeek !== resolvedDay &&
              window.dayOfWeek !== previousDay
            ),
            ...exceptionToWindow(exception, resolvedDay)
          ]
        : weeklyWindows

    const scheduleOpen =
      exception
        ? scheduleIsOpen(windows, resolvedDay, previousDay, nowMinutes)
        : weeklyHours.length > 0
          ? scheduleIsOpen(windows, resolvedDay, previousDay, nowMinutes)
          : false

    const scheduleSource =
      exception
        ? 'EXCEPTION'
        : storeWeeklyHours.length > 0
          ? 'STORE'
          : organizationWeeklyHours.length > 0
            ? 'ORGANIZATION'
          : 'DEFAULT'

    const rawOverrideMode =
      'manualOverrideMode' in store
        ? String(store.manualOverrideMode)
        : 'AUTO'

    const overrideUntil =
      'manualOverrideUntil' in store
        ? store.manualOverrideUntil ?? null
        : null

    const overrideExpired =
      overrideUntil !== null &&
      overrideUntil <= resolvedDate

    const manualOverride =
      overrideExpired
        ? 'AUTO'
        : rawOverrideMode as ManualOverrideMode

    if (overrideExpired && rawOverrideMode !== 'AUTO') {
      await prisma.onlineStore.update({
        where: {
          id: storeId
        },
        data: {
          manualOverrideMode: 'AUTO',
          manualOverrideUntil: null,
          manualOverrideReason: null
        }
      })
    }

    const legacyManualClosed =
      false

    const openNow =
      store.active &&
      (
        manualOverride === 'FORCE_OPEN' ||
        (
          manualOverride === 'AUTO' &&
          scheduleOpen
        )
      )

    const windowsForDate = (date: Date, candidateDay: number) => {
      const futureException =
        pickScopedException(
          exceptions.filter(candidate =>
            localDateKey(candidate.date) === localDateKey(date)
          ),
          storeId,
          normalizedChannel
        )

      return futureException
        ? exceptionToWindow(futureException, candidateDay)
        : null
    }

    const nextOpening =
      openNow
        ? null
        : nextOpeningAt(
            weeklyWindows,
            localDate,
            resolvedDay,
            nowMinutes,
            timezone,
            windowsForDate
          )

    const nextClosing =
      scheduleOpen
        ? nextClosingAt(windows, localDate, resolvedDay, previousDay, nowMinutes, timezone)
        : null

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
    } else if (manualOverride === 'FORCE_CLOSED') {
      unavailableReason = 'MANUALLY_CLOSED'
    } else if (manualOverride === 'AUTO' && !scheduleOpen) {
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
      openNow

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
      availability: {
        isActive: store.active,
        isWithinBusinessHours: scheduleOpen,
        manualOverride,
        isOpen: openNow,
        acceptingOrders,
        reason: unavailableReason,
        timezone,
        nextOpeningAt: nextOpening,
        nextClosingAt: nextClosing,
        legacyManualClosed
      },
      delivery: {
        enabled: effective.deliveryEnabled,
        pickupEnabled: effective.pickupEnabled,
        counterEnabled: effective.counterEnabled,
        dineInEnabled: effective.dineInEnabled,
        openNow,
        acceptingOrders,
        unavailableReason,
        manualOverride,
        timezone,
        nextOpeningAt: nextOpening,
        nextClosingAt: nextClosing,
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
        manualOverride,
        schedule: scheduleSource,
        legacyFallback: settings ? null : 'ONLINE_STORE_DEFAULTS'
      }
    }
  }

  async updateAvailability({
    organizationId,
    userId,
    storeId,
    mode,
    until,
    reason
  }: ActorRequest & StoreRequest & {
    mode: ManualOverrideMode
    until?: Date | null
    reason?: string | null
  }) {
    await ensureStoreBelongsToOrganization(organizationId, storeId)

    const store =
      await prisma.onlineStore.update({
        where: {
          id: storeId
        },
        data: {
          manualOverrideMode: mode,
          manualOverrideUntil: mode === 'AUTO' ? null : until ?? null,
          manualOverrideReason: mode === 'AUTO' ? null : reason ?? null,
          manualOverrideUpdatedAt: new Date(),
          manualOverrideUpdatedByUserId: userId
        }
      })

    await new CreateAuditLogService().execute({
      organizationId,
      userId,
      entity: 'OnlineStore',
      entityId: storeId,
      action: AuditAction.ONLINE_STORE_AVAILABILITY_UPDATED,
      description: 'Status de funcionamento da loja online atualizado',
      metadata: {
        storeId,
        mode,
        until: until?.toISOString() ?? null,
        reason: reason ?? null
      }
    })

    const operation =
      await this.resolveOperation({
        organizationId,
        storeId,
        channel: SettingsChannel.DIGITAL_MENU
      })

    return {
      store,
      availability: operation.availability,
      operation
    }
  }
}
