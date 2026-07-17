type CustomerWithRelations = {
  id: string
  name: string
  phone: string | null
  email: string | null
  document: string | null
  birthDate: Date | null
  notes: string | null
  active: boolean
  firstSource: string
  lastSource: string
  firstSeenAt: Date
  lastSeenAt: Date
  createdAt: Date
  updatedAt: Date
  addresses?: unknown[]
  customerInterests?: {
    source: string | null
    interest: Record<string, unknown>
  }[]
}

export function presentCustomer(customer: CustomerWithRelations) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    document: customer.document,
    birthDate: customer.birthDate,
    notes: customer.notes,
    active: customer.active,
    firstSource: customer.firstSource,
    lastSource: customer.lastSource,
    firstSeenAt: customer.firstSeenAt,
    lastSeenAt: customer.lastSeenAt,
    addresses: customer.addresses ?? [],
    interests:
      customer.customerInterests?.map(customerInterest => ({
        ...customerInterest.interest,
        source: customerInterest.source
      })) ?? [],
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  }
}
