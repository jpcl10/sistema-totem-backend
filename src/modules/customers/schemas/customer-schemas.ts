import { z } from 'zod'
import { CustomerInterestSource } from '@prisma/client'

const optionalTrimmedString = z.string().trim().optional().nullable()

export const listCustomersQuerySchema = z.object({
  search: z.string().trim().optional(),
  active: z.coerce.boolean().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  document: z.string().trim().optional(),
  interestId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export const customerParamsSchema = z.object({
  customerId: z.string().min(1)
})

export const customerAddressParamsSchema = customerParamsSchema.extend({
  addressId: z.string().min(1)
})

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1),
  phone: optionalTrimmedString,
  email: optionalTrimmedString,
  document: optionalTrimmedString,
  birthDate: z.coerce.date().optional().nullable(),
  notes: optionalTrimmedString,
  active: z.boolean().optional()
})

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  name: z.string().trim().min(1).optional()
})

export const updateCustomerStatusSchema = z.object({
  active: z.boolean()
})

export const createCustomerAddressSchema = z.object({
  label: optionalTrimmedString,
  recipientName: optionalTrimmedString,
  street: z.string().trim().min(1),
  number: optionalTrimmedString,
  complement: optionalTrimmedString,
  neighborhood: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,
  postalCode: optionalTrimmedString,
  reference: optionalTrimmedString,
  active: z.boolean().optional(),
  isDefault: z.boolean().optional()
})

export const updateCustomerAddressSchema = createCustomerAddressSchema.partial()

export const updateCustomerAddressStatusSchema = z.object({
  active: z.boolean()
})

export const interestParamsSchema = z.object({
  interestId: z.string().min(1)
})

export const customerInterestParamsSchema = customerParamsSchema.extend({
  interestId: z.string().min(1)
})

export const listInterestsQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(100)
})

export const createInterestSchema = z.object({
  name: z.string().trim().min(1),
  key: z.string().trim().min(1).optional(),
  active: z.boolean().optional()
})

export const updateInterestSchema = createInterestSchema.partial()

export const updateInterestStatusSchema = z.object({
  active: z.boolean()
})

export const addCustomerInterestSchema = z.object({
  interestId: z.string().min(1),
  source: z.nativeEnum(CustomerInterestSource).optional()
})
