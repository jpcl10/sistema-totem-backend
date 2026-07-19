import assert from 'node:assert/strict'
import test from 'node:test'
import { PrintJobStatus } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { PrinterFactory } from '../../../lib/printers/printer-factory.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'
import { ProcessPrintJobsService } from './process-print-jobs-service.js'

const organizationId = 'org-1'

function printingSettings() {
  const enabledSource = {
    enabled: true,
    autoPrint: true
  }

  return {
    printing: {
      printingEnabled: true,
      autoPrintEnabled: true,
      sources: {
        EVENT: enabledSource,
        TOTEM: enabledSource,
        MANUAL_EVENT: enabledSource,
        ONLINE_STORE: enabledSource,
        MANUAL_STORE: enabledSource
      }
    }
  }
}

function makeJob(status: PrintJobStatus = PrintJobStatus.PENDING, attempts = 1) {
  return {
    id: 'print-1',
    status,
    attempts,
    eventId: 'event-1',
    storeId: null,
    orderId: 'order-1',
    printerId: 'printer-1',
    deviceId: null,
    sector: 'KITCHEN',
    payload: {
      domain: 'EVENT_ORDER',
      source: 'EVENT',
      title: 'PEDIDO',
      items: [{ name: 'Item', quantity: 1 }]
    },
    printer: {
      id: 'printer-1',
      active: true,
      connectionType: 'TCP_IP',
      ipAddress: '127.0.0.1',
      port: 9100
    },
    event: {
      id: 'event-1',
      organizationId
    },
    store: null,
    order: {
      id: 'order-1'
    }
  }
}

function installMocks({
  existingStatus = PrintJobStatus.PENDING,
  claimCounts = [1],
  printerError,
  attempts = 1
}: {
  existingStatus?: PrintJobStatus
  claimCounts?: number[]
  printerError?: Error
  attempts?: number
}) {
  const originals = {
    findUnique: prisma.eventPrintJob.findUnique,
    updateMany: prisma.eventPrintJob.updateMany,
    printerFactory: PrinterFactory.getPrinter,
    settingsResolver: SettingsResolverService.prototype.execute,
    audit: CreateAuditLogService.prototype.execute
  }

  const updateManyCalls: any[] = []
  let findUniqueCalls = 0
  let printCalls = 0

  ;(prisma.eventPrintJob.findUnique as any) = async () => {
    findUniqueCalls += 1

    if (findUniqueCalls === 1) {
      return {
        id: 'print-1',
        status: existingStatus
      }
    }

    return makeJob(PrintJobStatus.PROCESSING, attempts)
  }

  ;(prisma.eventPrintJob.updateMany as any) = async (args: any) => {
    updateManyCalls.push(args)

    if (args.data.status === PrintJobStatus.PROCESSING) {
      return {
        count: claimCounts.shift() ?? 0
      }
    }

    return {
      count: 1
    }
  }

  PrinterFactory.getPrinter = (() => ({
    print: async () => {
      printCalls += 1
      if (printerError) {
        throw printerError
      }
    }
  })) as any

  SettingsResolverService.prototype.execute = async function () {
    return printingSettings() as any
  }

  CreateAuditLogService.prototype.execute = async function () {
    return {
      auditLog: {
        id: 'audit-1'
      }
    } as any
  }

  return {
    updateManyCalls,
    get printCalls() {
      return printCalls
    },
    restore() {
      ;(prisma.eventPrintJob.findUnique as any) = originals.findUnique
      ;(prisma.eventPrintJob.updateMany as any) = originals.updateMany
      PrinterFactory.getPrinter = originals.printerFactory
      SettingsResolverService.prototype.execute = originals.settingsResolver
      CreateAuditLogService.prototype.execute = originals.audit
    }
  }
}

test('does not reprocess a completed print job still present in Redis', async () => {
  const mocks = installMocks({
    existingStatus: PrintJobStatus.COMPLETED
  })

  try {
    const result = await new ProcessPrintJobsService().processOne({
      printJobId: 'print-1',
      workerId: 'worker-1'
    }) as any

    assert.equal(result.skipped, true)
    assert.equal(mocks.updateManyCalls.length, 0)
    assert.equal(mocks.printCalls, 0)
  } finally {
    mocks.restore()
  }
})

test('only one process can claim the same print job', async () => {
  const mocks = installMocks({
    claimCounts: [1, 0]
  })

  try {
    await Promise.all([
      new ProcessPrintJobsService().processOne({
        printJobId: 'print-1',
        workerId: 'worker-1'
      }),
      new ProcessPrintJobsService().processOne({
        printJobId: 'print-1',
        workerId: 'worker-2'
      })
    ])

    assert.equal(mocks.printCalls, 1)
  } finally {
    mocks.restore()
  }
})

test('claim includes stale lock recovery for PROCESSING jobs', async () => {
  const mocks = installMocks({
    existingStatus: PrintJobStatus.PROCESSING,
    claimCounts: [1]
  })

  try {
    await new ProcessPrintJobsService().processOne({
      printJobId: 'print-1',
      workerId: 'worker-1'
    })

    const claimCall = mocks.updateManyCalls[0]
    assert.deepEqual(claimCall.data.status, PrintJobStatus.PROCESSING)
    assert.ok(
      claimCall.where.OR.some(
        (condition: any) => condition.status === PrintJobStatus.PROCESSING
      )
    )
  } finally {
    mocks.restore()
  }
})

test('marks transient print failures as RETRY and releases the lock', async () => {
  const mocks = installMocks({
    printerError: new Error('temporary network failure'),
    attempts: 2
  })

  try {
    await assert.rejects(
      () => new ProcessPrintJobsService().processOne({
        printJobId: 'print-1',
        workerId: 'worker-1',
        attemptNumber: 2,
        maxAttempts: 5
      }),
      /temporary network failure/
    )

    const failureCall = mocks.updateManyCalls[mocks.updateManyCalls.length - 1]
    assert.equal(failureCall.data.status, PrintJobStatus.RETRY)
    assert.equal(failureCall.data.lockedAt, null)
    assert.equal(failureCall.data.lockedBy, null)
  } finally {
    mocks.restore()
  }
})

test('marks definitive print failures as ERROR', async () => {
  const mocks = installMocks({
    printerError: new Error('permanent failure'),
    attempts: 5
  })

  try {
    await assert.rejects(
      () => new ProcessPrintJobsService().processOne({
        printJobId: 'print-1',
        workerId: 'worker-1',
        attemptNumber: 5,
        maxAttempts: 5
      }),
      /permanent failure/
    )

    const failureCall = mocks.updateManyCalls[mocks.updateManyCalls.length - 1]
    assert.equal(failureCall.data.status, PrintJobStatus.ERROR)
  } finally {
    mocks.restore()
  }
})

test('completes a print job only while the current worker still owns the lock', async () => {
  const mocks = installMocks({})

  try {
    await new ProcessPrintJobsService().processOne({
      printJobId: 'print-1',
      workerId: 'worker-1'
    })

    const completionCall = mocks.updateManyCalls.find(
      call => call.data.status === PrintJobStatus.COMPLETED
    )

    assert.equal(completionCall.where.lockedBy, 'worker-1')
    assert.equal(completionCall.data.lockedAt, null)
    assert.equal(completionCall.data.lockedBy, null)
  } finally {
    mocks.restore()
  }
})
