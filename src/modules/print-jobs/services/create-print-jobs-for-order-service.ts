import { DeviceType, AuditAction } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface CreatePrintJobsForOrderServiceRequest {
  orderId: string
}

type JobSector = 'BAR' | 'KITCHEN'

type PrinterSector =
  | 'FULL_ORDER'
  | 'BAR'
  | 'KITCHEN'

type PrintTarget = {
  source: 'DEVICE' | 'LEGACY_PRINTER'
  id: string
  deviceId: string | null
  printerId: string | null
  sector: PrinterSector
  connectionType: string
  paperSize: string
}

function getMetadataValue(
  metadata: unknown,
  key: string
): string | null {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return null
  }

  const value =
    (metadata as Record<string, unknown>)[key]

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return String(value)
  }

  return null
}

export class CreatePrintJobsForOrderService {
  async execute({
    orderId
  }: CreatePrintJobsForOrderServiceRequest) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId
      },
      include: {
        event: true,
        printJobs: true,
        items: {
          include: {
            catalogProduct: {
              include: {
                catalogCategory: true
              }
            }
          }
        }
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    if (
      order.paymentStatus !== 'PAID' &&
      order.paymentStatus !== 'NOT_REQUIRED'
    ) {
      return {
        printJobs: []
      }
    }

    if (order.printJobs.length > 0) {
      return {
        printJobs: order.printJobs
      }
    }

    if (!order.event.printingEnabled) {
      return {
        printJobs: []
      }
    }

    /**
     * NOVO MODELO:
     * Busca dispositivos de impressão vinculados ao evento.
     *
     * Device é o novo modelo oficial para equipamentos.
     * EventPrinter continua como fallback legado.
     */
    const devices = await prisma.device.findMany({
      where: {
        eventId: order.eventId,
        status: 'ACTIVE',
        type: {
          in: [
            DeviceType.PRINTER,
            DeviceType.SK210
          ]
        }
      }
    })

    const deviceTargets: PrintTarget[] =
      devices.map(device => {
        const printerSector =
          getMetadataValue(
            device.metadata,
            'printerSector'
          ) as PrinterSector | null

        const connectionType =
          getMetadataValue(
            device.metadata,
            'connectionType'
          ) ?? (
            device.type === DeviceType.SK210
              ? 'SK210_LOCAL'
              : 'TCP_IP'
          )

        const paperSize =
          getMetadataValue(
            device.metadata,
            'paperSize'
          ) ?? order.event.printerPaperSize

        return {
          source: 'DEVICE',
          id: device.id,
          deviceId: device.id,
          printerId: null,
          sector:
            printerSector ?? 'FULL_ORDER',
          connectionType,
          paperSize
        }
      })

    /**
     * MODELO ANTIGO:
     * Mantém compatibilidade com EventPrinter para não quebrar
     * impressoras já cadastradas.
     */
    const legacyPrinters =
      await prisma.eventPrinter.findMany({
        where: {
          eventId: order.eventId,
          active: true
        }
      })

    const legacyTargets: PrintTarget[] =
      legacyPrinters.map(printer => ({
        source: 'LEGACY_PRINTER',
        id: printer.id,
        deviceId: null,
        printerId: printer.id,
        sector: printer.sector,
        connectionType: printer.connectionType,
        paperSize: printer.paperSize
      }))

    /**
     * Preferência:
     * 1. Usa Devices se existirem dispositivos de impressão.
     * 2. Caso contrário, usa EventPrinter legado.
     */
    const targets =
      deviceTargets.length > 0
        ? deviceTargets
        : legacyTargets

    function findTargetsBySector(
      sector: PrinterSector
    ) {
      return targets.filter(
        target => target.sector === sector
      )
    }

    const jobsToCreate: {
      eventId: string
      orderId: string
      printerId: string | null
      deviceId: string | null
      sector: JobSector
      payload: object
    }[] = []

    const basePayload = {
      eventName: order.event.name,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      createdAt: order.createdAt,
      totalInCents: order.totalInCents,
      paperSize: order.event.printerPaperSize
    }

    const fullOrderTargets =
      findTargetsBySector('FULL_ORDER')

    for (const target of fullOrderTargets) {
      jobsToCreate.push({
        eventId: order.eventId,
        orderId: order.id,
        printerId: target.printerId,
        deviceId: target.deviceId,
        sector: 'KITCHEN',

        payload: {
          ...basePayload,
          type: 'FULL_ORDER',
          title: 'PEDIDO COMPLETO',
          printerSector: 'FULL_ORDER',
          connectionType: target.connectionType,
          printTargetSource: target.source,
          printTargetId: target.id,
          paperSize: target.paperSize,
          items: order.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            sector:
              item.catalogProduct
                ?.catalogCategory
                ?.sector
          }))
        }
      })
    }

    if (
      order.event.printMode === 'BY_SECTOR' ||
      order.event.printMode === 'BOTH'
    ) {
      const sectors: JobSector[] = [
        'BAR',
        'KITCHEN'
      ]

      for (const sector of sectors) {
        const sectorItems = order.items.filter(
          item =>
            item.catalogProduct
              ?.catalogCategory
              ?.sector === sector
        )

        if (sectorItems.length === 0) {
          continue
        }

        const sectorTargets =
          findTargetsBySector(sector)

        for (const target of sectorTargets) {
          jobsToCreate.push({
            eventId: order.eventId,
            orderId: order.id,
            printerId: target.printerId,
            deviceId: target.deviceId,
            sector,

            payload: {
              ...basePayload,
              type: 'SECTOR',
              title:
                sector === 'BAR'
                  ? 'COMANDA BAR'
                  : 'COMANDA COZINHA',
              sector,
              printerSector: sector,
              connectionType: target.connectionType,
              printTargetSource: target.source,
              printTargetId: target.id,
              paperSize: target.paperSize,
              items: sectorItems.map(item => ({
                name: item.productName,
                quantity: item.quantity
              }))
            }
          })
        }
      }
    }

    const printJobs = []
    const createAuditLogService = new CreateAuditLogService()

    for (const job of jobsToCreate) {
      const printJob =
        await prisma.eventPrintJob.create({
          data: job,
          include: {
            printer: true,
            device: true
          }
        })

      // Audit: PRINT_JOB_CREATED
      await createAuditLogService.execute({
        organizationId: order.event.organizationId,
        eventId: order.eventId,
        entity: 'PrintJob',
        entityId: printJob.id,
        action: AuditAction.PRINT_JOB_CREATED,
        description: 'Impressão criada',
        metadata: {
          printJobId: printJob.id,
          orderId: order.id,
          printerId: printJob.printerId
        }
      })

      printJobs.push(printJob)
    }

    return {
      printJobs
    }
  }
}