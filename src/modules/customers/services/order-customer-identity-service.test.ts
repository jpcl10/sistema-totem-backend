import assert from 'node:assert/strict'
import test from 'node:test'
import { CustomerSource } from '@prisma/client'

import { createManualOnlineOrderSchema } from '../../online-stores/schemas/create-manual-online-order-schema.js'
import { createOnlineOrderSchema } from '../../online-stores/schemas/create-online-order-schema.js'
import { ResolveOrderCustomerIdentityService } from './order-customer-identity-service.js'

function createMockTx() {
  const customers = [
    {
      id: 'customer-1',
      organizationId: 'org-1',
      name: 'Joao',
      phone: '5511999999999',
      normalizedPhone: '5511999999999',
      active: true
    }
  ]

  const addresses = [
    {
      id: 'address-home',
      organizationId: 'org-1',
      customerId: 'customer-1',
      street: 'Rua A',
      number: '10',
      neighborhood: 'Centro',
      complement: 'Casa',
      reference: 'Portao azul',
      active: true
    },
    {
      id: 'address-work',
      organizationId: 'org-1',
      customerId: 'customer-1',
      street: 'Rua B',
      number: '20',
      neighborhood: 'Comercial',
      complement: 'Sala 2',
      reference: null,
      active: true
    }
  ]

  return {
    customers,
    addresses,
    tx: {
      customer: {
        findFirst: async ({ where }: any) => {
          return customers.find(customer => {
            if (where.id && customer.id !== where.id) {
              return false
            }

            if (
              where.normalizedPhone &&
              customer.normalizedPhone !== where.normalizedPhone
            ) {
              return false
            }

            return (
              customer.organizationId === where.organizationId &&
              customer.active === where.active
            )
          }) ?? null
        },
        create: async ({ data }: any) => {
          const customer = {
            id: `customer-${customers.length + 1}`,
            active: true,
            ...data
          }

          customers.push(customer)

          return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone
          }
        },
        update: async ({ where, data }: any) => {
          const customer = customers.find(current => current.id === where.id)!
          Object.assign(customer, data)

          return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone
          }
        }
      },
      customerAddress: {
        findFirst: async ({ where }: any) => {
          return addresses.find(address => {
            if (where.id && address.id !== where.id) {
              return false
            }

            if (where.street && address.street !== where.street) {
              return false
            }

            if (
              where.number !== undefined &&
              address.number !== where.number
            ) {
              return false
            }

            if (
              where.neighborhood !== undefined &&
              address.neighborhood !== where.neighborhood
            ) {
              return false
            }

            return (
              address.organizationId === where.organizationId &&
              address.customerId === where.customerId &&
              address.active === where.active
            )
          }) ?? null
        },
        create: async ({ data }: any) => {
          const address = {
            id: `address-${addresses.length + 1}`,
            active: true,
            ...data
          }

          addresses.push(address)

          return {
            id: address.id,
            street: address.street,
            number: address.number,
            neighborhood: address.neighborhood,
            complement: address.complement,
            reference: address.reference
          }
        }
      }
    }
  }
}

test('creates customer and address for a new phone', async () => {
  const { tx, customers, addresses } = createMockTx()

  const result = await new ResolveOrderCustomerIdentityService().execute({
    tx: tx as any,
    organizationId: 'org-1',
    source: CustomerSource.ONLINE,
    customer: {
      name: 'Maria',
      phone: '(11) 98888-7777',
      email: 'maria@example.com',
      document: '123.456.789-00',
      notes: 'Sem cebola'
    },
    address: {
      label: 'Casa',
      street: 'Rua Nova',
      number: '123',
      neighborhood: 'Centro',
      complement: 'Apto 4',
      reference: 'Perto da praca'
    },
    shouldResolveAddress: true
  })

  assert.equal(result.customer?.id, 'customer-2')
  assert.equal(result.address?.id, 'address-3')
  assert.equal(customers.length, 2)
  assert.equal(addresses.length, 3)
})

test('loads existing customer by phone and reuses selected address', async () => {
  const { tx, customers, addresses } = createMockTx()

  const result = await new ResolveOrderCustomerIdentityService().execute({
    tx: tx as any,
    organizationId: 'org-1',
    source: CustomerSource.ONLINE,
    customer: {
      phone: '55 11 99999-9999'
    },
    address: {
      id: 'address-work',
      street: '',
      number: null,
      neighborhood: null
    },
    shouldResolveAddress: true
  })

  assert.equal(result.customer?.id, 'customer-1')
  assert.equal(result.address?.id, 'address-work')
  assert.equal(result.address?.neighborhood, 'Comercial')
  assert.equal(customers.length, 1)
  assert.equal(addresses.length, 2)
})

test('reuses an existing matching address instead of duplicating it', async () => {
  const { tx, addresses } = createMockTx()

  const result = await new ResolveOrderCustomerIdentityService().execute({
    tx: tx as any,
    organizationId: 'org-1',
    source: CustomerSource.ADMIN,
    customer: {
      id: 'customer-1'
    },
    address: {
      street: 'Rua A',
      number: '10',
      neighborhood: 'Centro'
    },
    shouldResolveAddress: true
  })

  assert.equal(result.address?.id, 'address-home')
  assert.equal(addresses.length, 2)
})

test('rejects an address that does not belong to the customer', async () => {
  const { tx } = createMockTx()

  await assert.rejects(
    () => new ResolveOrderCustomerIdentityService().execute({
      tx: tx as any,
      organizationId: 'org-1',
      source: CustomerSource.ONLINE,
      customer: {
        id: 'customer-1'
      },
      address: {
        id: 'missing-address',
        street: '',
        number: null,
        neighborhood: null
      },
      shouldResolveAddress: true
    }),
    /Customer address not found/
  )
})

test('online checkout accepts existing customerAddressId without address fields', () => {
  const parsed = createOnlineOrderSchema.parse({
    customerId: 'customer-1',
    customerAddressId: 'address-home',
    customerName: 'Joao',
    customerPhone: '5511999999999',
    fulfillment: 'DELIVERY',
    paymentMethod: 'PIX',
    items: [
      {
        catalogProductId: 'product-1',
        quantity: 1
      }
    ]
  })

  assert.equal(parsed.customerAddressId, 'address-home')
})

test('manual online order accepts existing customerAddressId without delivery payload', () => {
  const parsed = createManualOnlineOrderSchema.parse({
    customerId: 'customer-1',
    customerAddressId: 'address-home',
    fulfillment: 'DELIVERY',
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    items: [
      {
        catalogProductId: 'product-1',
        quantity: 1
      }
    ]
  })

  assert.equal(parsed.customerAddressId, 'address-home')
})
