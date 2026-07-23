import {
  AuditAction,
  CategorySector,
  Prisma,
  UserRole
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { enqueuePrintJob } from '../../../infra/queues/index.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface CreateTestPrintJobServiceRequest {
  organizationId: string
  userId: string
  userRole: UserRole
  eventId: string
  deviceId: string
  printerId?: string | null
  sector: 'GENERAL' | 'BAR' | 'KITCHEN'
}

export class CreateTestPrintJobService {
  async execute({
    organizationId,
    userId,
    eventId,
    deviceId,
    printerId,
    sector
  }: CreateTestPrintJobServiceRequest) {
    const [event, device, printer] = await Promise.all([
      prisma.event.findFirst({
        where: { id: eventId, organizationId },
        select: { id: true, name: true, organizationId: true }
      }),
      prisma.device.findFirst({
        where: {
          id: deviceId,
          organizationId,
          OR: [
            { eventId },
            { eventId: null }
          ]
        },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          status: true,
          eventId: true,
          metadata: true
        }
      }),
      printerId
        ? prisma.eventPrinter.findFirst({
            where: {
              id: printerId,
              event: {
                id: eventId,
                organizationId
              }
            }
          })
        : Promise.resolve(null)
    ])

    if (!event) throw new Error('Event not found')
    if (!device) throw new Error('Device not found for this event')
    if (printerId && !printer) throw new Error('Printer not found for this event')

    const now = new Date()
    const idempotencyKey = [
      'admin-test',
      eventId,
      deviceId,
      printerId ?? 'device',
      sector,
      now.toISOString()
    ].join(':')

    const payload: Prisma.InputJsonObject = {
      domain: 'TEST_PRINT',
      type: 'TEST',
      title: 'TESTE DE IMPRESSAO',
      eventName: event.name,
      eventId,
      source: 'ADMIN',
      sector,
      printerSector: sector,
      device: {
        id: device.id,
        name: device.name,
        codePreview: `${device.code.slice(0, 4)}...${device.code.slice(-3)}`,
        type: device.type,
        status: device.status
      },
      printer: printer
        ? {
            id: printer.id,
            name: printer.name,
            sector: printer.sector,
            connectionType: printer.connectionType,
            paperSize: printer.paperSize
          }
        : null,
      createdAt: now.toISOString(),
      text: 'Teste de impressao Defumar',
      items: [
        {
          name: 'Teste de impressao Defumar',
          quantity: 1,
          sector,
          notes: `Gerado em ${now.toISOString()}`,
          options: []
        }
      ],
      totalInCents: 0,
      layout: {
        showLogo: false,
        showPrices: false,
        showQrCode: false,
        showPayment: false,
        showOrderSource: true,
        showOrderNotes: true,
        showItemNotes: true,
        showOptions: true
      }
    }

    const printJob = await prisma.eventPrintJob.create({
      data: {
        eventId,
        deviceId: device.id,
        printerId: printer?.id ?? null,
        sector: sector === 'BAR' ? CategorySector.BAR : CategorySector.KITCHEN,
        status: 'PENDING',
        idempotencyKey,
        payload
      }
    })

    if (!printJob.deviceId) {
      await enqueuePrintJob(printJob.id)
    }

    await new CreateAuditLogService().execute({
      organizationId,
      eventId,
      userId,
      deviceId: device.id,
      entity: 'EventPrintJob',
      entityId: printJob.id,
      action: AuditAction.PRINT_JOB_CREATED,
      description: 'Job de teste de impressao criado',
      metadata: {
        printJobId: printJob.id,
        deviceId: device.id,
        printerId: printer?.id ?? null,
        sector,
        idempotencyKey
      }
    })

    return { printJob }
  }
}
