import { z } from 'zod'

const originValues = [
  'ONLINE',
  'TOTEM',
  'EVENT',
  'POS',
  'COMANDA',
  'QR_MESA',
  'GARCOM_MOBILE',
  'API',
  'WHATSAPP'
] as const

const sourceTypeValues = ['EVENT', 'ONLINE'] as const

const sourceValues = [
  'EVENT',
  'TOTEM',
  'MANUAL_EVENT',
  'ONLINE_STORE',
  'MANUAL_STORE',
  'DIGITAL_MENU',
  'POS',
  'API',
  'WHATSAPP'
] as const

const orderTypeValues = ['EVENT_ORDER', 'ONLINE_ORDER'] as const

const statusValues = [
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED'
] as const

const paymentStatusValues = [
  'NOT_REQUIRED',
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED'
] as const

const paymentMethodValues = [
  'PIX_MANUAL',
  'PIX_AUTOMATIC',
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'COURTESY',
  'NFC_BALANCE',
  'OTHER',
  'PIX',
  'CARD_ON_DELIVERY'
] as const

const fulfillmentTypeValues = [
  'DELIVERY',
  'PICKUP',
  'COUNTER',
  'DINE_IN'
] as const

const dateFieldValues = ['createdAt', 'paidAt'] as const
const sortByValues = ['createdAt', 'paidAt', 'totalInCents', 'orderNumber'] as const
const sortOrderValues = ['asc', 'desc'] as const

function emptyToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() === ''
    ? undefined
    : value
}

function upperStringOrUndefined(value: unknown) {
  const normalizedValue = emptyToUndefined(value)

  if (typeof normalizedValue !== 'string') {
    return normalizedValue
  }

  const normalized = normalizedValue.trim().toUpperCase()

  if (normalized === 'ALL') {
    return undefined
  }

  return normalized
}

function normalizeStatus(value: unknown) {
  const normalizedValue = upperStringOrUndefined(value)

  switch (normalizedValue) {
    case 'RECEIVED':
      return 'NEW'
    case 'DELIVERED':
      return 'COMPLETED'
    default:
      return normalizedValue
  }
}

const optionalTrimmedString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional()
)

export const listUnifiedOrdersQuerySchema = z.object({
  origin: z.preprocess(
    upperStringOrUndefined,
    z.enum(originValues).optional()
  ),
  sourceType: z.preprocess(
    upperStringOrUndefined,
    z.enum(sourceTypeValues).optional()
  ),
  source: z.preprocess(
    upperStringOrUndefined,
    z.enum(sourceValues).optional()
  ),
  orderType: z.preprocess(
    upperStringOrUndefined,
    z.enum(orderTypeValues).optional()
  ),
  status: z.preprocess(
    normalizeStatus,
    z.enum(statusValues).optional()
  ),
  paymentStatus: z.preprocess(
    upperStringOrUndefined,
    z.enum(paymentStatusValues).optional()
  ),
  paymentMethod: z.preprocess(
    upperStringOrUndefined,
    z.enum(paymentMethodValues).optional()
  ),
  fulfillmentType: z.preprocess(
    upperStringOrUndefined,
    z.enum(fulfillmentTypeValues).optional()
  ),
  dateField: z.preprocess(
    emptyToUndefined,
    z.enum(dateFieldValues).optional()
  ).default('createdAt'),
  startDate: optionalTrimmedString,
  endDate: optionalTrimmedString,
  eventId: optionalTrimmedString,
  storeId: optionalTrimmedString,
  customerId: optionalTrimmedString,
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  page: z.coerce.number().int().positive().catch(1),
  limit: z.coerce.number().int().positive().max(100).catch(50),
  sortBy: z.preprocess(
    emptyToUndefined,
    z.enum(sortByValues).optional()
  ).default('createdAt'),
  sortOrder: z.preprocess(
    emptyToUndefined,
    z.enum(sortOrderValues).optional()
  ).default('desc')
})
