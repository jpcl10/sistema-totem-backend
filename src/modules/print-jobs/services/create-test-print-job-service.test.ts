import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CategorySector,
  DeviceStatus,
  DeviceType,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { CreateTestPrintJobService } from './create-test-print-job-service.js'

function installPrismaMocks(overrides: {
  eventFindFirst?: (args: any) => Promise<any>
  deviceFindFirst?: (args: any) => Promise<any>
  eventPrinterFindFirst?: (args: any) => Promise<any>
  eventPrintJobCreate?: (args: any) => Promise<any>
}) {
  const originals = {
    eventFindFirst: prisma.event.findFirst,
    deviceFindFirst: prisma.device.findFirst,
    eventPrinterFindFirst: prisma.eventPrinter.findFirst,
    eventPrintJobCreate: prisma.eventPrintJob.create
  }

  ;(prisma.event.findFirst as any) =
    overrides.eventFindFirst ?? (async () => null)
  ;(prisma.device.findFirst as any) =
    overrides.deviceFindFirst ?? (async () => null)
  ;(prisma.eventPrinter.findFirst as any) =
    overrides.eventPrinterFindFirst ?? (async () => null)
  ;(prisma.eventPrintJob.create as any) =
    overrides.eventPrintJobCreate ?? (async () => null)

  return () => {
    ;(prisma.event.findFirst as any) = originals.eventFindFirst
    ;(prisma.device.findFirst as any) = originals.deviceFindFirst
    ;(prisma.eventPrinter.findFirst as any) = originals.eventPrinterFindFirst
    ;(prisma.eventPrintJob.create as any) = originals.eventPrintJobCreate
  }
}

test('test print creates a TEST EventPrintJob for the selected tenant device', async () => {
  const originalAudit = CreateAuditLogService.prototype.execute
  let createArgs: any
  let auditArgs: any

  ;(CreateAuditLogService.prototype.execute as any) = async function (
    args: any
  ) {
    auditArgs = args
    return { auditLog: { id: 'audit-1' } }
  }

  const restore = installPrismaMocks({
    eventFindFirst: async (args) => {
      assert.deepEqual(args.where, {
        id: 'event-1',
        organizationId: 'org-1'
      })
      return { id: 'event-1', name: 'Festa de Teste', organizationId: 'org-1' }
    },
    deviceFindFirst: async (args) => {
      assert.equal(args.where.id, 'device-1')
      assert.equal(args.where.organizationId, 'org-1')
      assert.deepEqual(args.where.OR, [{ eventId: 'event-1' }, { eventId: null }])
      return {
        id: 'device-1',
        name: 'TotemBridge Caixa',
        code: 'DEVICECODE123',
        type: DeviceType.TOTEM,
        status: DeviceStatus.ACTIVE,
        eventId: 'event-1',
        metadata: {}
      }
    },
    eventPrinterFindFirst: async (args) => {
      assert.equal(args.where.id, 'printer-1')
      assert.equal(args.where.event.id, 'event-1')
      assert.equal(args.where.event.organizationId, 'org-1')
      return {
        id: 'printer-1',
        name: 'Bar',
        sector: CategorySector.BAR,
        connectionType: 'USB',
        paperSize: '80mm'
      }
    },
    eventPrintJobCreate: async (args) => {
      createArgs = args
      return {
        id: 'print-test-1',
        eventId: args.data.eventId,
        deviceId: args.data.deviceId,
        printerId: args.data.printerId,
        sector: args.data.sector,
        status: args.data.status,
        payload: args.data.payload
      }
    }
  })

  try {
    const result = await new CreateTestPrintJobService().execute({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: UserRole.ADMIN,
      eventId: 'event-1',
      deviceId: 'device-1',
      printerId: 'printer-1',
      sector: 'BAR'
    })

    assert.equal(result.printJob.id, 'print-test-1')
    assert.equal(createArgs.data.eventId, 'event-1')
    assert.equal(createArgs.data.deviceId, 'device-1')
    assert.equal(createArgs.data.printerId, 'printer-1')
    assert.equal(createArgs.data.status, 'PENDING')
    assert.equal(createArgs.data.sector, CategorySector.BAR)
    assert.equal(createArgs.data.payload.domain, 'TEST_PRINT')
    assert.equal(createArgs.data.payload.type, 'TEST')
    assert.equal(createArgs.data.payload.text, 'Teste de impressao Defumar')
    assert.equal('orderId' in createArgs.data, false)
    assert.equal(auditArgs.organizationId, 'org-1')
    assert.equal(auditArgs.metadata.deviceId, 'device-1')
  } finally {
    restore()
    CreateAuditLogService.prototype.execute = originalAudit
  }
})
