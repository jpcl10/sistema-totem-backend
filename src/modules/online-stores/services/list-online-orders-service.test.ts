import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '../../../lib/prisma.js'
import { ListOnlineOrdersService } from './list-online-orders-service.js'

test('filters online orders by the store and organization context', async () => {
  const originalFindFirst = prisma.onlineStore.findFirst
  const originalFindMany = prisma.onlineOrder.findMany

  const calls: any[] = []

  ;(prisma.onlineStore.findFirst as any) = async (args: any) => {
    calls.push({ type: 'store', args })
    return { id: 'store-1', organizationId: 'org-1' }
  }

  ;(prisma.onlineOrder.findMany as any) = async (args: any) => {
    calls.push({ type: 'orders', args })
    return []
  }

  try {
    await new ListOnlineOrdersService().execute({
      storeId: 'store-1',
      organizationId: 'org-1',
      userRole: 'ADMIN' as any
    })

    assert.equal(calls[0].args.where.id, 'store-1')
    assert.equal(calls[0].args.where.organizationId, 'org-1')
    assert.equal(calls[1].args.where.storeId, 'store-1')
  } finally {
    ;(prisma.onlineStore.findFirst as any) = originalFindFirst
    ;(prisma.onlineOrder.findMany as any) = originalFindMany
  }
})
