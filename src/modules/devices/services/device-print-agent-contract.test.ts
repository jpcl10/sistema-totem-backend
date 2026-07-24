import assert from 'node:assert/strict'
import test from 'node:test'
import { DeviceType, UserRole } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { CreateDeviceService } from './create-device-service.js'
import { ListDevicePendingPrintJobsService } from './list-device-pending-print-jobs-service.js'
import { MarkDevicePrintJobPrintedService } from './mark-device-print-job-printed-service.js'
import { MarkDevicePrintJobErrorService } from './mark-device-print-job-error-service.js'

function installDeviceMocks(overrides: {
  deviceFindUnique?: (args: any) => Promise<any>
  deviceFindFirst?: (args: any) => Promise<any>
  deviceCreate?: (args: any) => Promise<any>
  eventFindFirst?: (args: any) => Promise<any>
  storeFindFirst?: (args: any) => Promise<any>
  printJobFindMany?: (args: any) => Promise<any>
  printJobFindFirst?: (args: any) => Promise<any>
  printJobUpdate?: (args: any) => Promise<any>
}) {
  const originals = {
    deviceFindUnique: prisma.device.findUnique,
    deviceFindFirst: prisma.device.findFirst,
    deviceCreate: prisma.device.create,
    eventFindFirst: prisma.event.findFirst,
    storeFindFirst: prisma.onlineStore.findFirst,
    printJobFindMany: prisma.eventPrintJob.findMany,
    printJobFindFirst: prisma.eventPrintJob.findFirst,
    printJobUpdate: prisma.eventPrintJob.update,
    audit: CreateAuditLogService.prototype.execute
  }

  ;(prisma.device.findUnique as any) =
    overrides.deviceFindUnique ?? (async () => null)
  ;(prisma.device.findFirst as any) =
    overrides.deviceFindFirst ?? (async () => null)
  ;(prisma.device.create as any) =
    overrides.deviceCreate ?? (async () => null)
  ;(prisma.event.findFirst as any) =
    overrides.eventFindFirst ?? (async () => null)
  ;(prisma.onlineStore.findFirst as any) =
    overrides.storeFindFirst ?? (async () => null)
  ;(prisma.eventPrintJob.findMany as any) =
    overrides.printJobFindMany ?? (async () => [])
  ;(prisma.eventPrintJob.findFirst as any) =
    overrides.printJobFindFirst ?? (async () => null)
  ;(prisma.eventPrintJob.update as any) =
    overrides.printJobUpdate ?? (async () => null)
  ;(CreateAuditLogService.prototype.execute as any) =
    async () => ({ auditLog: { id: 'audit-1' } })

  return () => {
    ;(prisma.device.findUnique as any) = originals.deviceFindUnique
    ;(prisma.device.findFirst as any) = originals.deviceFindFirst
    ;(prisma.device.create as any) = originals.deviceCreate
    ;(prisma.event.findFirst as any) = originals.eventFindFirst
    ;(prisma.onlineStore.findFirst as any) = originals.storeFindFirst
    ;(prisma.eventPrintJob.findMany as any) = originals.printJobFindMany
    ;(prisma.eventPrintJob.findFirst as any) = originals.printJobFindFirst
    ;(prisma.eventPrintJob.update as any) = originals.printJobUpdate
    CreateAuditLogService.prototype.execute = originals.audit
  }
}

test('create device generates a one-time secret and stores only its hash', async () => {
  let createArgs: any
  const restore = installDeviceMocks({
    deviceFindUnique: async () => null,
    deviceCreate: async (args) => {
      createArgs = args
      return {
        id: 'device-1',
        organizationId: args.data.organizationId,
        name: args.data.name,
        code: args.data.code,
        type: args.data.type,
        status: args.data.status,
        authStatus: 'PENDING',
        deviceSecretHash: args.data.deviceSecretHash
      }
    }
  })

  try {
    const result = await new CreateDeviceService().execute({
      organizationId: 'org-1',
      userRole: UserRole.ADMIN,
      userId: 'user-1',
      name: 'Cozinha',
      code: 'agent-01',
      type: DeviceType.PRINT_AGENT,
      locationName: 'Cozinha'
    })

    assert.equal(result.device.code, 'AGENT-01')
    assert.match(result.deviceSecret, /^dvs_[a-f0-9]{64}$/)
    assert.equal(createArgs.data.deviceSecretHash.length, 64)
    assert.notEqual(createArgs.data.deviceSecretHash, result.deviceSecret)
    assert.equal('deviceSecret' in createArgs.data, false)
  } finally {
    restore()
  }
})

test('pending queue is isolated to the authenticated device', async () => {
  let findManyArgs: any
  const restore = installDeviceMocks({
    printJobFindMany: async (args) => {
      findManyArgs = args
      return []
    }
  })

  try {
    await new ListDevicePendingPrintJobsService().execute({
      deviceId: 'device-1'
    })

    assert.deepEqual(findManyArgs.where, {
      deviceId: 'device-1',
      status: 'PENDING'
    })
  } finally {
    restore()
  }
})

test('printed confirmation only accepts jobs owned by the device and still printable', async () => {
  let findFirstArgs: any
  let updateArgs: any
  const restore = installDeviceMocks({
    printJobFindFirst: async (args) => {
      findFirstArgs = args
      return { id: 'job-1', deviceId: 'device-1', status: 'PENDING' }
    },
    printJobUpdate: async (args) => {
      updateArgs = args
      return { id: 'job-1', status: args.data.status }
    }
  })

  try {
    const result = await new MarkDevicePrintJobPrintedService().execute({
      printJobId: 'job-1',
      deviceId: 'device-1'
    })

    assert.equal(result.printJob.status, 'PRINTED')
    assert.equal(findFirstArgs.where.deviceId, 'device-1')
    assert.deepEqual(findFirstArgs.where.status.in, ['PENDING', 'PROCESSING'])
    assert.equal(updateArgs.data.lockedAt, null)
    assert.equal(updateArgs.data.lockedBy, null)
  } finally {
    restore()
  }
})

test('error confirmation records failure only for jobs owned by the device', async () => {
  let findFirstArgs: any
  let updateArgs: any
  const restore = installDeviceMocks({
    printJobFindFirst: async (args) => {
      findFirstArgs = args
      return { id: 'job-1', deviceId: 'device-1', status: 'PROCESSING' }
    },
    printJobUpdate: async (args) => {
      updateArgs = args
      return { id: 'job-1', status: args.data.status }
    }
  })

  try {
    const result = await new MarkDevicePrintJobErrorService().execute({
      printJobId: 'job-1',
      deviceId: 'device-1',
      errorMessage: 'spooler offline'
    })

    assert.equal(result.printJob.status, 'ERROR')
    assert.equal(findFirstArgs.where.deviceId, 'device-1')
    assert.deepEqual(findFirstArgs.where.status.in, ['PENDING', 'PROCESSING'])
    assert.equal(updateArgs.data.errorMessage, 'spooler offline')
    assert.equal(updateArgs.data.lockedAt, null)
    assert.equal(updateArgs.data.lockedBy, null)
  } finally {
    restore()
  }
})

test('disabled device jobs cannot be confirmed when lookup does not match', async () => {
  const restore = installDeviceMocks({
    printJobFindFirst: async (args) => {
      assert.equal(args.where.deviceId, 'device-disabled')
      assert.deepEqual(args.where.status.in, ['PENDING', 'PROCESSING'])
      return null
    }
  })

  try {
    await assert.rejects(
      () => new MarkDevicePrintJobPrintedService().execute({
        printJobId: 'job-1',
        deviceId: 'device-disabled'
      }),
      /Print job not found/
    )
  } finally {
    restore()
  }
})
