import {
  DeviceType,
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  OnlineOrderStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { DashboardPeriod } from '../../../shared/utils/get-period-date-filter.js'

type FinancialOrderType = 'EVENT_ORDER' | 'ONLINE_ORDER'

type FinancialSource =
  | 'EVENT'
  | 'TOTEM'
  | 'MANUAL_EVENT'
  | 'ONLINE_STORE'
  | 'MANUAL_STORE'
  | 'DIGITAL_MENU'
  | 'POS'
  | 'API'
  | 'WHATSAPP'

type NormalizedPaymentMethod = 'PIX' | 'CASH' | 'CARD' | 'DEBIT' | 'COURTESY' | 'NFC_BALANCE' | 'OTHER'

interface FinancialAggregationServiceRequest {
  organizationId: string
  userRole: UserRole
  period?: DashboardPeriod
  startDate?: string
  endDate?: string
  eventId?: string
  storeId?: string
  source?: FinancialSource
  orderType?: FinancialOrderType
  paymentMethod?: string
  paymentStatus?: PaymentStatus
  fulfillmentType?: OnlineOrderFulfillmentType
  now?: Date
}

type DateRange = {
  gte: Date
  lte: Date
}

type PaymentMethodBucket = {
  amountInCents: number
  ordersCount: number
  methods: Record<string, number>
}

type SummaryMap = Record<string, number>

type TimeseriesGranularity = 'HOUR' | 'DAY' | 'MONTH'

type TimeseriesPoint = {
  periodStart: string
  label: string
  grossRevenueInCents: number
  paidOrdersCount: number
  averageTicketInCents: number
}

type RawTimeseriesRow = {
  periodStart: Date
  grossRevenueInCents: bigint | number | null
  paidOrdersCount: bigint | number | null
}

const fallbackTimezone = 'America/Sao_Paulo'

function getTimeZoneOffsetInMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  )

  const localTimeAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  )

  const dateWithoutMilliseconds =
    Math.floor(date.getTime() / 1000) * 1000

  return localTimeAsUtc - dateWithoutMilliseconds
}

function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number
) {
  const utcGuess = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond
  )

  let offset = getTimeZoneOffsetInMs(new Date(utcGuess), timeZone)
  let utcDate = new Date(utcGuess - offset)
  offset = getTimeZoneOffsetInMs(utcDate, timeZone)
  utcDate = new Date(utcGuess - offset)

  return utcDate
}

function getZonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day
  }
}

function parseLocalDate(value: string, endOfDay: boolean) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
  )

  if (!match) {
    throw new Error('Invalid custom date range')
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4] ? Number(match[4]) : endOfDay ? 23 : 0,
    minute: match[5] ? Number(match[5]) : endOfDay ? 59 : 0,
    second: match[6] ? Number(match[6]) : endOfDay ? 59 : 0,
    millisecond: match[4] ? 0 : endOfDay ? 999 : 0
  }
}

function getFinancialDateRange({
  period,
  startDate,
  endDate,
  timeZone,
  now = new Date()
}: {
  period: DashboardPeriod
  startDate?: string
  endDate?: string
  timeZone: string
  now?: Date
}): DateRange | undefined {
  if (period === 'EVENT') {
    return undefined
  }

  if (period === 'YESTERDAY') {
    const current = getZonedDateParts(now, timeZone)
    const todayStart = zonedTimeToUtc(
      timeZone,
      current.year,
      current.month,
      current.day,
      0,
      0,
      0,
      0
    )
    const yesterday = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayParts = getZonedDateParts(yesterday, timeZone)

    return {
      gte: zonedTimeToUtc(
        timeZone,
        yesterdayParts.year,
        yesterdayParts.month,
        yesterdayParts.day,
        0,
        0,
        0,
        0
      ),
      lte: zonedTimeToUtc(
        timeZone,
        yesterdayParts.year,
        yesterdayParts.month,
        yesterdayParts.day,
        23,
        59,
        59,
        999
      )
    }
  }

  if (period === '24H') {
    return {
      gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      lte: now
    }
  }

  if (period === '7D' || period === 'LAST_7_DAYS') {
    return {
      gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      lte: now
    }
  }

  if (period === 'LAST_30_DAYS') {
    return {
      gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      lte: now
    }
  }

  if (period === 'CUSTOM') {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required for CUSTOM period')
    }

    const start = parseLocalDate(startDate, false)
    const end = parseLocalDate(endDate, true)

    return {
      gte: zonedTimeToUtc(
        timeZone,
        start.year,
        start.month,
        start.day,
        start.hour,
        start.minute,
        start.second,
        start.millisecond
      ),
      lte: zonedTimeToUtc(
        timeZone,
        end.year,
        end.month,
        end.day,
        end.hour,
        end.minute,
        end.second,
        end.millisecond
      )
    }
  }

  const current = getZonedDateParts(now, timeZone)

  return {
    gte: zonedTimeToUtc(
      timeZone,
      current.year,
      current.month,
      current.day,
      0,
      0,
      0,
      0
    ),
    lte: zonedTimeToUtc(
      timeZone,
      current.year,
      current.month,
      current.day,
      23,
      59,
      59,
      999
    )
  }
}

function normalizeEventPaymentMethod(method: PaymentMethod | null): NormalizedPaymentMethod {
  switch (method) {
    case PaymentMethod.PIX_MANUAL:
    case PaymentMethod.PIX_AUTOMATIC:
      return 'PIX'
    case PaymentMethod.CASH:
      return 'CASH'
    case PaymentMethod.CREDIT_CARD:
      return 'CARD'
    case PaymentMethod.DEBIT_CARD:
      return 'DEBIT'
    case PaymentMethod.COURTESY:
      return 'COURTESY'
    case PaymentMethod.NFC_BALANCE:
      return 'NFC_BALANCE'
    default:
      return 'OTHER'
  }
}

function normalizeOnlinePaymentMethod(
  method: OnlineOrderPaymentMethod | null
): NormalizedPaymentMethod {
  switch (method) {
    case OnlineOrderPaymentMethod.PIX:
      return 'PIX'
    case OnlineOrderPaymentMethod.CASH:
      return 'CASH'
    case OnlineOrderPaymentMethod.CARD_ON_DELIVERY:
      return 'CARD'
    default:
      return 'OTHER'
  }
}

function addAmount(map: SummaryMap, key: string, value: number) {
  map[key] = (map[key] ?? 0) + value
}

function addPaymentBucket(
  byPaymentMethod: Record<string, PaymentMethodBucket>,
  normalizedMethod: NormalizedPaymentMethod,
  originalMethod: string,
  amountInCents: number,
  ordersCount: number
) {
  const current = byPaymentMethod[normalizedMethod] ?? {
    amountInCents: 0,
    ordersCount: 0,
    methods: {}
  }

  current.amountInCents += amountInCents
  current.ordersCount += ordersCount
  current.methods[originalMethod] =
    (current.methods[originalMethod] ?? 0) + amountInCents
  byPaymentMethod[normalizedMethod] = current
}

function paymentMethodFilter(paymentMethod?: string) {
  if (!paymentMethod) {
    return undefined
  }

  return paymentMethod.toUpperCase()
}

function shouldIncludeEventOrders(request: FinancialAggregationServiceRequest) {
  if (request.orderType === 'ONLINE_ORDER') {
    return false
  }

  if (request.storeId || request.fulfillmentType) {
    return false
  }

  return !request.source ||
    ['EVENT', 'TOTEM', 'MANUAL_EVENT', 'POS'].includes(request.source)
}

function shouldIncludeOnlineOrders(request: FinancialAggregationServiceRequest) {
  if (request.orderType === 'EVENT_ORDER') {
    return false
  }

  if (request.eventId) {
    return false
  }

  return !['EVENT', 'TOTEM', 'MANUAL_EVENT'].includes(request.source ?? '')
}

function buildEventWhere({
  organizationId,
  eventId,
  source,
  paymentMethod,
  paymentStatus,
  dateField,
  dateRange
}: FinancialAggregationServiceRequest & {
  dateField: 'paidAt' | 'createdAt'
  dateRange?: DateRange
}): Prisma.OrderWhereInput {
  const normalizedPaymentMethod = paymentMethodFilter(paymentMethod)

  return {
    ...(eventId ? { eventId } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(dateRange ? { [dateField]: dateRange } : {}),
    ...(normalizedPaymentMethod &&
    normalizedPaymentMethod in PaymentMethod
      ? { paymentMethod: normalizedPaymentMethod as PaymentMethod }
      : {}),
    ...(source === 'TOTEM'
      ? { device: { is: { type: DeviceType.TOTEM } } }
      : {}),
    ...(source === 'MANUAL_EVENT' || source === 'POS'
      ? { paymentNotes: 'Venda manual criada pelo painel' }
      : {}),
    event: {
      organizationId
    }
  }
}

function buildOnlineWhere({
  organizationId,
  storeId,
  source,
  paymentMethod,
  paymentStatus,
  fulfillmentType,
  dateField,
  dateRange
}: FinancialAggregationServiceRequest & {
  dateField: 'paidAt' | 'createdAt'
  dateRange?: DateRange
}): Prisma.OnlineOrderWhereInput {
  const normalizedPaymentMethod = paymentMethodFilter(paymentMethod)
  const sourceFilter =
    source === 'MANUAL_STORE'
      ? OrderSource.ADMIN
      : source === 'ONLINE_STORE' || source === 'DIGITAL_MENU'
        ? OrderSource.DIGITAL_MENU
        : source === 'API'
          ? OrderSource.API
          : source === 'WHATSAPP'
            ? OrderSource.WHATSAPP
            : source === 'POS'
              ? OrderSource.POS
              : undefined

  return {
    ...(storeId ? { storeId } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(fulfillmentType ? { fulfillmentType } : {}),
    ...(sourceFilter ? { source: sourceFilter } : {}),
    ...(dateRange ? { [dateField]: dateRange } : {}),
    ...(normalizedPaymentMethod &&
    normalizedPaymentMethod in OnlineOrderPaymentMethod
      ? { paymentMethod: normalizedPaymentMethod as OnlineOrderPaymentMethod }
      : {}),
    store: {
      organizationId
    }
  }
}

function getTimeseriesGranularity({
  period,
  dateRange
}: {
  period: DashboardPeriod
  dateRange?: DateRange
}): TimeseriesGranularity {
  if (period === 'TODAY' || period === 'YESTERDAY' || period === '24H') {
    return 'HOUR'
  }

  if (period === '7D' || period === 'LAST_7_DAYS' || period === 'LAST_30_DAYS') {
    return 'DAY'
  }

  if (period === 'CUSTOM' && dateRange) {
    const days =
      (dateRange.lte.getTime() - dateRange.gte.getTime()) /
      (24 * 60 * 60 * 1000)

    if (days <= 2) {
      return 'HOUR'
    }

    if (days <= 90) {
      return 'DAY'
    }

    return 'MONTH'
  }

  return 'DAY'
}

function getTimeseriesStep(granularity: TimeseriesGranularity) {
  switch (granularity) {
    case 'HOUR':
      return '1 hour'
    case 'MONTH':
      return '1 month'
    case 'DAY':
    default:
      return '1 day'
  }
}

function getDateTruncGranularity(granularity: TimeseriesGranularity) {
  switch (granularity) {
    case 'HOUR':
      return 'hour'
    case 'MONTH':
      return 'month'
    case 'DAY':
    default:
      return 'day'
  }
}

function formatTimeseriesLabel(date: Date, timezone: string, granularity: TimeseriesGranularity) {
  if (granularity === 'HOUR') {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (granularity === 'MONTH') {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      month: '2-digit',
      year: 'numeric'
    }).format(date)
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit'
  }).format(date)
}

function toNumber(value: bigint | number | null | undefined) {
  if (typeof value === 'bigint') {
    return Number(value)
  }

  return value ?? 0
}

function buildEventTimeseriesConditions(request: FinancialAggregationServiceRequest) {
  const normalizedPaymentMethod = paymentMethodFilter(request.paymentMethod)
  const conditions: Prisma.Sql[] = [
    Prisma.sql`e."organizationId" = ${request.organizationId}`,
    Prisma.sql`o."paymentStatus" = ${PaymentStatus.PAID}::"PaymentStatus"`,
    Prisma.sql`o."status" <> ${OrderStatus.CANCELLED}::"OrderStatus"`
  ]

  if (request.eventId) {
    conditions.push(Prisma.sql`o."eventId" = ${request.eventId}`)
  }

  if (
    normalizedPaymentMethod &&
    normalizedPaymentMethod in PaymentMethod
  ) {
    conditions.push(
      Prisma.sql`o."paymentMethod" = ${normalizedPaymentMethod}::"PaymentMethod"`
    )
  } else if (normalizedPaymentMethod) {
    conditions.push(Prisma.sql`false`)
  }

  if (request.source === 'TOTEM') {
    conditions.push(Prisma.sql`d."type" = ${DeviceType.TOTEM}::"DeviceType"`)
  }

  if (request.source === 'MANUAL_EVENT' || request.source === 'POS') {
    conditions.push(Prisma.sql`o."paymentNotes" = 'Venda manual criada pelo painel'`)
  }

  if (request.source === 'EVENT') {
    conditions.push(Prisma.sql`
      o."paymentNotes" IS DISTINCT FROM 'Venda manual criada pelo painel'
      AND (
        o."deviceId" IS NULL
        OR d."id" IS NULL
        OR d."type" <> ${DeviceType.TOTEM}::"DeviceType"
      )
    `)
  }

  return Prisma.join(conditions, ' AND ')
}

function buildOnlineTimeseriesConditions(request: FinancialAggregationServiceRequest) {
  const normalizedPaymentMethod = paymentMethodFilter(request.paymentMethod)
  const conditions: Prisma.Sql[] = [
    Prisma.sql`s."organizationId" = ${request.organizationId}`,
    Prisma.sql`oo."paymentStatus" = ${PaymentStatus.PAID}::"PaymentStatus"`,
    Prisma.sql`oo."status" <> ${OnlineOrderStatus.CANCELLED}::"OnlineOrderStatus"`
  ]

  const sourceFilter =
    request.source === 'MANUAL_STORE'
      ? OrderSource.ADMIN
      : request.source === 'ONLINE_STORE' || request.source === 'DIGITAL_MENU'
        ? OrderSource.DIGITAL_MENU
        : request.source === 'API'
          ? OrderSource.API
          : request.source === 'WHATSAPP'
            ? OrderSource.WHATSAPP
            : request.source === 'POS'
              ? OrderSource.POS
              : undefined

  if (request.storeId) {
    conditions.push(Prisma.sql`oo."storeId" = ${request.storeId}`)
  }

  if (request.fulfillmentType) {
    conditions.push(
      Prisma.sql`oo."fulfillmentType" = ${request.fulfillmentType}::"OnlineOrderFulfillmentType"`
    )
  }

  if (sourceFilter) {
    conditions.push(Prisma.sql`oo."source" = ${sourceFilter}::"OrderSource"`)
  }

  if (
    normalizedPaymentMethod &&
    normalizedPaymentMethod in OnlineOrderPaymentMethod
  ) {
    conditions.push(
      Prisma.sql`oo."paymentMethod" = ${normalizedPaymentMethod}::"OnlineOrderPaymentMethod"`
    )
  } else if (normalizedPaymentMethod) {
    conditions.push(Prisma.sql`false`)
  }

  return Prisma.join(conditions, ' AND ')
}

async function buildTimeseries({
  request,
  dateRange,
  timezone,
  period,
  includeEventOrders,
  includeOnlineOrders
}: {
  request: FinancialAggregationServiceRequest
  dateRange?: DateRange
  timezone: string
  period: DashboardPeriod
  includeEventOrders: boolean
  includeOnlineOrders: boolean
}) {
  const granularity = getTimeseriesGranularity({
    period,
    dateRange
  })

  if (!dateRange || request.paymentStatus && request.paymentStatus !== PaymentStatus.PAID) {
    return {
      granularity,
      timezone,
      dateField: 'paidAt',
      points: [] as TimeseriesPoint[]
    }
  }

  const truncGranularity = getDateTruncGranularity(granularity)
  const step = getTimeseriesStep(granularity)
  const eventConditions = includeEventOrders
    ? buildEventTimeseriesConditions(request)
    : Prisma.sql`false`
  const onlineConditions = includeOnlineOrders
    ? buildOnlineTimeseriesConditions(request)
    : Prisma.sql`false`

  const rows = await prisma.$queryRaw<RawTimeseriesRow[]>`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc(${truncGranularity}, ${dateRange.gte}::timestamptz AT TIME ZONE ${timezone}),
        date_trunc(${truncGranularity}, ${dateRange.lte}::timestamptz AT TIME ZONE ${timezone}),
        ${step}::interval
      ) AS bucket_local
    ),
    revenue AS (
      SELECT
        date_trunc(${truncGranularity}, o."paidAt" AT TIME ZONE ${timezone}) AS bucket_local,
        SUM(o."totalInCents")::bigint AS gross_revenue_in_cents,
        COUNT(*)::bigint AS paid_orders_count
      FROM "Order" o
      INNER JOIN "Event" e ON e."id" = o."eventId"
      LEFT JOIN "Device" d ON d."id" = o."deviceId"
      WHERE ${eventConditions}
        AND o."paidAt" >= ${dateRange.gte}
        AND o."paidAt" <= ${dateRange.lte}
      GROUP BY 1

      UNION ALL

      SELECT
        date_trunc(${truncGranularity}, oo."paidAt" AT TIME ZONE ${timezone}) AS bucket_local,
        SUM(oo."totalInCents")::bigint AS gross_revenue_in_cents,
        COUNT(*)::bigint AS paid_orders_count
      FROM "OnlineOrder" oo
      INNER JOIN "OnlineStore" s ON s."id" = oo."storeId"
      WHERE ${onlineConditions}
        AND oo."paidAt" >= ${dateRange.gte}
        AND oo."paidAt" <= ${dateRange.lte}
      GROUP BY 1
    ),
    merged AS (
      SELECT
        bucket_local,
        SUM(gross_revenue_in_cents)::bigint AS gross_revenue_in_cents,
        SUM(paid_orders_count)::bigint AS paid_orders_count
      FROM revenue
      GROUP BY bucket_local
    )
    SELECT
      (b.bucket_local AT TIME ZONE ${timezone}) AS "periodStart",
      COALESCE(m.gross_revenue_in_cents, 0)::bigint AS "grossRevenueInCents",
      COALESCE(m.paid_orders_count, 0)::bigint AS "paidOrdersCount"
    FROM buckets b
    LEFT JOIN merged m ON m.bucket_local = b.bucket_local
    ORDER BY b.bucket_local ASC
  `

  return {
    granularity,
    timezone,
    dateField: 'paidAt',
    points: rows.map(row => {
      const periodStart = new Date(row.periodStart)
      const grossRevenueInCents = toNumber(row.grossRevenueInCents)
      const paidOrdersCount = toNumber(row.paidOrdersCount)

      return {
        periodStart: periodStart.toISOString(),
        label: formatTimeseriesLabel(periodStart, timezone, granularity),
        grossRevenueInCents,
        paidOrdersCount,
        averageTicketInCents:
          paidOrdersCount > 0
            ? Math.round(grossRevenueInCents / paidOrdersCount)
            : 0
      }
    })
  }
}

export class FinancialAggregationService {
  async execute(request: FinancialAggregationServiceRequest) {
    const period = request.period ?? 'TODAY'

    const [settings, event, store] = await Promise.all([
      prisma.organizationSettings.findUnique({
        where: {
          organizationId: request.organizationId
        },
        select: {
          timezone: true
        }
      }),
      request.eventId
        ? prisma.event.findFirst({
            where: {
              id: request.eventId,
              organizationId: request.organizationId
            },
            select: {
              id: true,
              name: true,
              slug: true
            }
          })
        : Promise.resolve(null),
      request.storeId
        ? prisma.onlineStore.findFirst({
            where: {
              id: request.storeId,
              organizationId: request.organizationId
            },
            select: {
              id: true,
              name: true,
              slug: true
            }
          })
        : Promise.resolve(null)
    ])

    if (request.eventId && !event) {
      throw new Error('Event not found')
    }

    if (request.storeId && !store) {
      throw new Error('Store not found')
    }

    const timezone = settings?.timezone ?? fallbackTimezone
    const dateRange = getFinancialDateRange({
      period,
      startDate: request.startDate,
      endDate: request.endDate,
      timeZone: timezone,
      now: request.now
    })

    const includeEventOrders = shouldIncludeEventOrders(request)
    const includeOnlineOrders = shouldIncludeOnlineOrders(request)
    const includePaidRevenue =
      !request.paymentStatus ||
      request.paymentStatus === PaymentStatus.PAID
    const includePendingCount =
      !request.paymentStatus ||
      request.paymentStatus === PaymentStatus.PENDING
    const includeCancelledCount =
      !request.paymentStatus ||
      request.paymentStatus === PaymentStatus.CANCELLED
    const includeRefundedCount =
      !request.paymentStatus ||
      request.paymentStatus === PaymentStatus.REFUNDED

    const paidEventWhere = includeEventOrders && includePaidRevenue
      ? {
          ...buildEventWhere({
            ...request,
            dateField: 'paidAt',
            dateRange
          }),
          paymentStatus: PaymentStatus.PAID,
          status: {
            not: OrderStatus.CANCELLED
          }
        }
      : null

    const paidOnlineWhere = includeOnlineOrders && includePaidRevenue
      ? {
          ...buildOnlineWhere({
            ...request,
            dateField: 'paidAt',
            dateRange
          }),
          paymentStatus: PaymentStatus.PAID,
          status: {
            not: OnlineOrderStatus.CANCELLED
          }
        }
      : null

    const pendingEventWhere = includeEventOrders && includePendingCount
      ? {
          ...buildEventWhere({
            ...request,
            dateField: 'createdAt',
            dateRange
          }),
          paymentStatus: PaymentStatus.PENDING,
          status: {
            not: OrderStatus.CANCELLED
          }
        }
      : null

    const pendingOnlineWhere = includeOnlineOrders && includePendingCount
      ? {
          ...buildOnlineWhere({
            ...request,
            dateField: 'createdAt',
            dateRange
          }),
          paymentStatus: PaymentStatus.PENDING,
          status: {
            not: OnlineOrderStatus.CANCELLED
          }
        }
      : null

    const cancelledEventWhere = includeEventOrders && includeCancelledCount
      ? {
          ...buildEventWhere({
            ...request,
            dateField: 'createdAt',
            dateRange
          }),
          OR: [
            { status: OrderStatus.CANCELLED },
            { paymentStatus: PaymentStatus.CANCELLED }
          ]
        }
      : null

    const cancelledOnlineWhere = includeOnlineOrders && includeCancelledCount
      ? {
          ...buildOnlineWhere({
            ...request,
            dateField: 'createdAt',
            dateRange
          }),
          OR: [
            { status: OnlineOrderStatus.CANCELLED },
            { paymentStatus: PaymentStatus.CANCELLED }
          ]
        }
      : null

    const refundedEventWhere = includeEventOrders && includeRefundedCount
      ? {
          ...buildEventWhere({
            ...request,
            dateField: 'paidAt',
            dateRange
          }),
          paymentStatus: PaymentStatus.REFUNDED
        }
      : null

    const refundedOnlineWhere = includeOnlineOrders && includeRefundedCount
      ? {
          ...buildOnlineWhere({
            ...request,
            dateField: 'paidAt',
            dateRange
          }),
          paymentStatus: PaymentStatus.REFUNDED
        }
      : null

    const [
      paidEventAggregate,
      paidOnlineAggregate,
      deliveryFeeAggregate,
      refundedEventAggregate,
      refundedOnlineAggregate,
      paidEventCount,
      paidOnlineCount,
      pendingEventCount,
      pendingOnlineCount,
      cancelledEventCount,
      cancelledOnlineCount,
      refundedEventCount,
      refundedOnlineCount,
      eventPaymentGroups,
      onlinePaymentGroups,
      onlineSourceGroups,
      onlineFulfillmentGroups,
      eventManualCount,
      eventTotemCount,
      eventDefaultCount
    ] = await Promise.all([
      paidEventWhere
        ? prisma.order.aggregate({
            where: paidEventWhere,
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve({ _sum: { totalInCents: 0 } }),
      paidOnlineWhere
        ? prisma.onlineOrder.aggregate({
            where: paidOnlineWhere,
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve({ _sum: { totalInCents: 0 } }),
      paidOnlineWhere
        ? prisma.onlineOrder.aggregate({
            where: paidOnlineWhere,
            _sum: {
              deliveryFeeInCents: true
            }
          })
        : Promise.resolve({ _sum: { deliveryFeeInCents: 0 } }),
      refundedEventWhere
        ? prisma.order.aggregate({
            where: refundedEventWhere,
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve({ _sum: { totalInCents: 0 } }),
      refundedOnlineWhere
        ? prisma.onlineOrder.aggregate({
            where: refundedOnlineWhere,
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve({ _sum: { totalInCents: 0 } }),
      paidEventWhere
        ? prisma.order.count({ where: paidEventWhere })
        : Promise.resolve(0),
      paidOnlineWhere
        ? prisma.onlineOrder.count({ where: paidOnlineWhere })
        : Promise.resolve(0),
      pendingEventWhere
        ? prisma.order.count({ where: pendingEventWhere })
        : Promise.resolve(0),
      pendingOnlineWhere
        ? prisma.onlineOrder.count({ where: pendingOnlineWhere })
        : Promise.resolve(0),
      cancelledEventWhere
        ? prisma.order.count({ where: cancelledEventWhere })
        : Promise.resolve(0),
      cancelledOnlineWhere
        ? prisma.onlineOrder.count({ where: cancelledOnlineWhere })
        : Promise.resolve(0),
      refundedEventWhere
        ? prisma.order.count({ where: refundedEventWhere })
        : Promise.resolve(0),
      refundedOnlineWhere
        ? prisma.onlineOrder.count({ where: refundedOnlineWhere })
        : Promise.resolve(0),
      paidEventWhere
        ? prisma.order.groupBy({
            by: ['paymentMethod'],
            where: paidEventWhere,
            _sum: {
              totalInCents: true
            },
            _count: {
              _all: true
            }
          })
        : Promise.resolve([]),
      paidOnlineWhere
        ? prisma.onlineOrder.groupBy({
            by: ['paymentMethod'],
            where: paidOnlineWhere,
            _sum: {
              totalInCents: true
            },
            _count: {
              _all: true
            }
          })
        : Promise.resolve([]),
      paidOnlineWhere
        ? prisma.onlineOrder.groupBy({
            by: ['source'],
            where: paidOnlineWhere,
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve([]),
      paidOnlineWhere
        ? prisma.onlineOrder.groupBy({
            by: ['fulfillmentType'],
            where: paidOnlineWhere,
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve([]),
      paidEventWhere
        ? prisma.order.aggregate({
            where: {
              ...paidEventWhere,
              paymentNotes: 'Venda manual criada pelo painel'
            },
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve({ _sum: { totalInCents: 0 } }),
      paidEventWhere
        ? prisma.order.aggregate({
            where: {
              ...paidEventWhere,
              device: {
                is: {
                  type: DeviceType.TOTEM
                }
              }
            },
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve({ _sum: { totalInCents: 0 } }),
      paidEventWhere
        ? prisma.order.aggregate({
            where: {
              ...paidEventWhere,
              paymentNotes: {
                not: 'Venda manual criada pelo painel'
              },
              OR: [
                {
                  deviceId: null
                },
                {
                  device: {
                    is: null
                  }
                },
                {
                  device: {
                    is: {
                      type: {
                        not: DeviceType.TOTEM
                      }
                    }
                  }
                }
              ]
            },
            _sum: {
              totalInCents: true
            }
          })
        : Promise.resolve({ _sum: { totalInCents: 0 } })
    ])

    const grossRevenueInCents =
      (paidEventAggregate._sum.totalInCents ?? 0) +
      (paidOnlineAggregate._sum.totalInCents ?? 0)
    const refundsInCents =
      (refundedEventAggregate._sum.totalInCents ?? 0) +
      (refundedOnlineAggregate._sum.totalInCents ?? 0)
    const paidOrdersCount = paidEventCount + paidOnlineCount
    const byPaymentMethod: Record<string, PaymentMethodBucket> = {}
    const bySource: SummaryMap = {}
    const byOrderType: SummaryMap = {
      EVENT_ORDER: paidEventAggregate._sum.totalInCents ?? 0,
      ONLINE_ORDER: paidOnlineAggregate._sum.totalInCents ?? 0
    }
    const byFulfillmentType: SummaryMap = {
      ON_SITE: paidEventAggregate._sum.totalInCents ?? 0
    }

    for (const group of eventPaymentGroups) {
      const originalMethod = group.paymentMethod ?? 'OTHER'
      addPaymentBucket(
        byPaymentMethod,
        normalizeEventPaymentMethod(group.paymentMethod),
        originalMethod,
        group._sum.totalInCents ?? 0,
        group._count._all
      )
    }

    for (const group of onlinePaymentGroups) {
      const originalMethod = group.paymentMethod ?? 'OTHER'
      addPaymentBucket(
        byPaymentMethod,
        normalizeOnlinePaymentMethod(group.paymentMethod),
        originalMethod,
        group._sum.totalInCents ?? 0,
        group._count._all
      )
    }

    if (includeEventOrders) {
      addAmount(bySource, 'EVENT', eventDefaultCount._sum.totalInCents ?? 0)
      addAmount(bySource, 'TOTEM', eventTotemCount._sum.totalInCents ?? 0)
      addAmount(bySource, 'MANUAL_EVENT', eventManualCount._sum.totalInCents ?? 0)
    }

    for (const group of onlineSourceGroups) {
      const source =
        group.source === OrderSource.ADMIN
          ? 'MANUAL_STORE'
          : group.source === OrderSource.DIGITAL_MENU
            ? 'DIGITAL_MENU'
            : group.source

      addAmount(bySource, source, group._sum.totalInCents ?? 0)
    }

    for (const group of onlineFulfillmentGroups) {
      addAmount(
        byFulfillmentType,
        group.fulfillmentType,
        group._sum.totalInCents ?? 0
      )
    }

    const timeseries = await buildTimeseries({
      request,
      dateRange,
      timezone,
      period,
      includeEventOrders,
      includeOnlineOrders
    })

    return {
      summary: {
        period: {
          type: period,
          timezone,
          startDate: dateRange?.gte.toISOString() ?? null,
          endDate: dateRange?.lte.toISOString() ?? null,
          revenueDateField: 'paidAt',
          operationalDateField: 'createdAt'
        },
        event,
        store,
        grossRevenueInCents,
        netRevenueInCents: grossRevenueInCents,
        deliveryFeesInCents:
          deliveryFeeAggregate._sum.deliveryFeeInCents ?? 0,
        discountsInCents: 0,
        refundsInCents,
        paidOrdersCount,
        pendingOrdersCount: pendingEventCount + pendingOnlineCount,
        canceledOrdersCount: cancelledEventCount + cancelledOnlineCount,
        refundedOrdersCount: refundedEventCount + refundedOnlineCount,
        averageTicketInCents:
          paidOrdersCount > 0
            ? Math.round(grossRevenueInCents / paidOrdersCount)
            : 0,
        byPaymentMethod,
        bySource,
        byOrderType,
        byFulfillmentType,
        timeseries,
        limitations: {
          discounts:
            'No discount field exists in Order or OnlineOrder; reported as 0.',
          netRevenue:
            'No payment fee/refund amount fields exist; net equals recognized paid order total.',
          refunds:
            'Refund amount is inferred from totalInCents for orders with paymentStatus REFUNDED.',
          eventOrderBreakdown:
            'Order does not store subtotal, delivery fee, discount, fulfillment type, or source; source is derived from device/paymentNotes.'
        }
      }
    }
  }
}
