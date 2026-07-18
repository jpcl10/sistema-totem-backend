import {
  AuditAction,
  CategorySector,
  DeviceType,
  PaymentStatus,
  Prisma
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import {
  EffectivePrintingSettings,
  PrintingSourceKey
} from '../../settings/services/printing-settings-service.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'

type OrderPrintDomain = 'EVENT_ORDER' | 'ONLINE_ORDER'
type JobSector = 'BAR' | 'KITCHEN'
type PrinterSector = 'FULL_ORDER' | 'BAR' | 'KITCHEN'

type PrintTarget = {
  source: 'DEVICE' | 'LEGACY_PRINTER'
  id: string
  deviceId: string | null
  printerId: string | null
  sector: PrinterSector
  connectionType: string
  paperSize: string
}

type PrintableItem = {
  name: string
  quantity: number
  sector: CategorySector | null
  notes?: string | null
  options: {
    groupName: string
    optionName: string
  }[]
}

type JobToCreate = {
  eventId: string | null
  orderId: string | null
  storeId: string | null
  onlineOrderId: string | null
  idempotencyKey: string
  printerId: string | null
  deviceId: string | null
  sector: JobSector
  payload: Prisma.InputJsonObject
}

interface OrderPrintOrchestratorRequest {
  domain: OrderPrintDomain
  orderId: string
}

function getMetadataValue(metadata: unknown, key: string): string | null {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return null
  }

  const value = (metadata as Record<string, unknown>)[key]

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  return null
}

function isPrinterSector(value: string | null): value is PrinterSector {
  return value === 'FULL_ORDER' || value === 'BAR' || value === 'KITCHEN'
}

function isPrintablePaymentStatus(paymentStatus: PaymentStatus) {
  return (
    paymentStatus === PaymentStatus.PAID ||
    paymentStatus === PaymentStatus.NOT_REQUIRED
  )
}

function findTargetsBySector(targets: PrintTarget[], sector: PrinterSector) {
  return targets.filter(target => target.sector === sector)
}

function mapPrintingSectorToPrinterSector(value: string | null): PrinterSector {
  if (value === 'COOK' || value === 'KITCHEN') {
    return 'KITCHEN'
  }

  if (value === 'BAR') {
    return 'BAR'
  }

  return 'FULL_ORDER'
}

function normalizePrintMode({
  sourcePrintMode,
  splitBySector
}: {
  sourcePrintMode: 'FULL_ORDER' | 'BY_SECTOR' | 'BOTH'
  splitBySector: boolean
}): 'FULL_ORDER' | 'BY_SECTOR' | 'BOTH' {
  if (sourcePrintMode === 'FULL_ORDER' && splitBySector) {
    return 'BY_SECTOR'
  }

  return sourcePrintMode
}

function shouldPrintBySettings({
  settings,
  source
}: {
  settings: EffectivePrintingSettings
  source: PrintingSourceKey
}) {
  const sourceSettings = settings.sources[source]

  return Boolean(
    settings.printingEnabled &&
    settings.autoPrintEnabled &&
    sourceSettings?.enabled &&
    sourceSettings?.autoPrint
  )
}

function resolvePaperSize({
  targetPaperSize,
  settingsPaperSize
}: {
  targetPaperSize?: string | null
  settingsPaperSize: string
}) {
  return targetPaperSize ?? settingsPaperSize
}

async function createJobsIdempotently({
  jobsToCreate,
  organizationId,
  eventId
}: {
  jobsToCreate: JobToCreate[]
  organizationId: string
  eventId: string | null
}) {
  const printJobs = []
  const audit = new CreateAuditLogService()

  for (const job of jobsToCreate) {
    const existingJob = await prisma.eventPrintJob.findUnique({
      where: {
        idempotencyKey: job.idempotencyKey
      },
      include: {
        printer: true,
        device: true
      }
    })

    if (existingJob) {
      printJobs.push(existingJob)
      continue
    }

    try {
      const printJob = await prisma.eventPrintJob.create({
        data: job,
        include: {
          printer: true,
          device: true
        }
      })

      await audit.execute({
        organizationId,
        eventId,
        entity: 'PrintJob',
        entityId: printJob.id,
        action: AuditAction.PRINT_JOB_CREATED,
        description: 'Impressao criada',
        metadata: {
          printJobId: printJob.id,
          orderId: printJob.orderId,
          onlineOrderId: printJob.onlineOrderId,
          printerId: printJob.printerId,
          deviceId: printJob.deviceId,
          idempotencyKey: printJob.idempotencyKey
        }
      })

      printJobs.push(printJob)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicatedJob = await prisma.eventPrintJob.findUnique({
          where: {
            idempotencyKey: job.idempotencyKey
          },
          include: {
            printer: true,
            device: true
          }
        })

        if (duplicatedJob) {
          printJobs.push(duplicatedJob)
          continue
        }
      }

      throw error
    }
  }

  return printJobs
}

export class OrderPrintOrchestratorService {
  async execute({ domain, orderId }: OrderPrintOrchestratorRequest) {
    if (domain === 'EVENT_ORDER') {
      return this.createForEventOrder(orderId)
    }

    return this.createForOnlineOrder(orderId)
  }

  private async createForEventOrder(orderId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId
      },
      include: {
        event: true,
        printJobs: true,
        device: true,
        items: {
          include: {
            catalogProduct: {
              include: {
                catalogCategory: true
              }
            },
            options: true,
            flavors: true
          }
        }
      }
    })

    if (!order) {
      throw new Error('Order not found')
    }

    const sourceKey: PrintingSourceKey =
      order.device?.type === DeviceType.TOTEM
        ? 'TOTEM'
        : order.paymentNotes === 'Venda manual criada pelo painel'
          ? 'MANUAL_EVENT'
          : 'EVENT'

    const effective =
      await new SettingsResolverService().execute({
        organizationId: order.event.organizationId,
        eventId: order.eventId,
        deviceId: order.deviceId ?? undefined
      })

    const printingSettings = effective.printing as EffectivePrintingSettings

    if (
      !shouldPrintBySettings({
        settings: printingSettings,
        source: sourceKey
      }) ||
      !isPrintablePaymentStatus(order.paymentStatus) ||
      order.items.length === 0
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

    const deviceTargets =
      await this.resolveDeviceTargets({
        organizationId: order.event.organizationId,
        eventId: order.eventId,
        storeId: null,
        settings: printingSettings
      })

    const legacyPrinters = await prisma.eventPrinter.findMany({
      where: {
        eventId: order.eventId,
        active: true
      }
    })

    const legacyTargets: PrintTarget[] = legacyPrinters.map(printer => ({
      source: 'LEGACY_PRINTER',
      id: printer.id,
      deviceId: null,
      printerId: printer.id,
      sector: printer.sector,
      connectionType: printer.connectionType,
      paperSize: printer.paperSize
    }))

    const targets = deviceTargets.length > 0 ? deviceTargets : legacyTargets
    const source = sourceKey
    const items: PrintableItem[] = order.items.map(item => ({
      name: item.productName,
      quantity: item.quantity,
      sector: item.catalogProduct?.catalogCategory?.sector ?? null,
      notes: item.notes,
      options: [
        ...item.flavors
          .sort((a, b) => a.position - b.position)
          .map(flavor => ({
            groupName: 'Meio a meio',
            optionName: `1/2 ${flavor.flavorName}`
          })),
        ...item.options.map(option => ({
          groupName: option.groupName,
          optionName: option.optionName
        }))
      ]
    }))

    const basePayload: Prisma.InputJsonObject = {
      domain: 'EVENT_ORDER',
      eventName: order.event.name,
      orderId: order.id,
      orderNumber: order.orderNumber,
      source,
      manualSale: sourceKey === 'MANUAL_EVENT',
      customerName: order.customerName,
      createdAt: order.createdAt.toISOString(),
      fulfillment: 'ON_SITE',
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalInCents: order.totalInCents,
      notes: order.paymentNotes,
      paperSize: printingSettings.paperSize,
      layout: {
        showLogo: printingSettings.showLogo,
        showPrices: printingSettings.showPrices,
        showQrCode: printingSettings.showQrCode,
        showPayment: printingSettings.showPayment,
        showOrderSource: printingSettings.showOrderSource,
        showOrderNotes: printingSettings.showOrderNotes,
        showItemNotes: printingSettings.showItemNotes,
        showOptions: printingSettings.showOptions
      }
    }

    const jobsToCreate = this.buildJobs({
      domain: 'EVENT_ORDER',
      orderId: order.id,
      eventId: order.eventId,
      onlineOrderId: null,
      storeId: null,
      printMode: normalizePrintMode({
        sourcePrintMode: printingSettings.sources[sourceKey].printMode,
        splitBySector: printingSettings.splitBySector
      }),
      targets,
      basePayload,
      items
    })

    const printJobs = await createJobsIdempotently({
      jobsToCreate,
      organizationId: order.event.organizationId,
      eventId: order.eventId
    })

    return {
      printJobs
    }
  }

  private async createForOnlineOrder(orderId: string) {
    const order = await prisma.onlineOrder.findFirst({
      where: {
        id: orderId
      },
      include: {
        store: true,
        printJobs: true,
        items: {
          include: {
            catalogProduct: {
              include: {
                catalogCategory: true
              }
            },
            options: true,
            flavors: true
          }
        }
      }
    })

    if (!order) {
      throw new Error('Online order not found')
    }

    const sourceKey: PrintingSourceKey =
      order.source === 'ADMIN'
        ? 'MANUAL_STORE'
        : 'ONLINE_STORE'

    const effective =
      await new SettingsResolverService().execute({
        organizationId: order.store.organizationId,
        storeId: order.storeId
      })

    const printingSettings = effective.printing as EffectivePrintingSettings

    if (
      !shouldPrintBySettings({
        settings: printingSettings,
        source: sourceKey
      }) ||
      !isPrintablePaymentStatus(order.paymentStatus) ||
      order.items.length === 0
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

    const targets =
      await this.resolveDeviceTargets({
        organizationId: order.store.organizationId,
        eventId: null,
        storeId: order.storeId,
        settings: printingSettings
      })

    const items: PrintableItem[] = order.items.map(item => ({
      name: item.productName,
      quantity: item.quantity,
      sector: item.catalogProduct?.catalogCategory?.sector ?? null,
      notes: item.notes,
      options: [
        ...item.flavors
          .sort((a, b) => a.position - b.position)
          .map(flavor => ({
            groupName: 'Meio a meio',
            optionName: `1/2 ${flavor.flavorName}`
          })),
        ...item.options.map(option => ({
          groupName: option.groupName,
          optionName: option.optionName
        }))
      ]
    }))

    const isDelivery = order.fulfillmentType === 'DELIVERY'
    const basePayload: Prisma.InputJsonObject = {
      domain: 'ONLINE_ORDER',
      storeName: order.store.name,
      onlineOrderId: order.id,
      orderNumber: order.orderNumber,
      source: order.source,
      manualSale: order.source === 'ADMIN',
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      createdAt: order.createdAt.toISOString(),
      fulfillment: order.fulfillmentType,
      deliveryAddress: isDelivery
        ? {
            address: order.deliveryAddress,
            number: order.deliveryNumber,
            neighborhood: order.deliveryNeighborhood,
            complement: order.deliveryComplement,
            reference: order.deliveryReference
          }
        : null,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      subtotalInCents: order.subtotalInCents,
      deliveryFeeInCents: order.deliveryFeeInCents,
      totalInCents: order.totalInCents,
      notes: order.notes,
      paperSize: printingSettings.paperSize,
      layout: {
        showLogo: printingSettings.showLogo,
        showPrices: printingSettings.showPrices,
        showQrCode: printingSettings.showQrCode,
        showPayment: printingSettings.showPayment,
        showOrderSource: printingSettings.showOrderSource,
        showOrderNotes: printingSettings.showOrderNotes,
        showItemNotes: printingSettings.showItemNotes,
        showOptions: printingSettings.showOptions
      }
    }

    const jobsToCreate = this.buildJobs({
      domain: 'ONLINE_ORDER',
      orderId: null,
      eventId: null,
      onlineOrderId: order.id,
      storeId: order.storeId,
      printMode: normalizePrintMode({
        sourcePrintMode: printingSettings.sources[sourceKey].printMode,
        splitBySector: printingSettings.splitBySector
      }),
      targets,
      basePayload,
      items
    })

    const printJobs = await createJobsIdempotently({
      jobsToCreate,
      organizationId: order.store.organizationId,
      eventId: null
    })

    return {
      printJobs
    }
  }

  private async resolveDeviceTargets({
    organizationId,
    eventId,
    storeId,
    settings
  }: {
    organizationId: string
    eventId: string | null
    storeId: string | null
    settings: EffectivePrintingSettings
  }): Promise<PrintTarget[]> {
    const configuredTargets = [
      {
        deviceId: settings.defaultPrinterDeviceId,
        sector: 'GENERAL'
      },
      {
        deviceId: settings.kitchenPrinterDeviceId,
        sector: 'COOK'
      },
      {
        deviceId: settings.barPrinterDeviceId,
        sector: 'BAR'
      },
      {
        deviceId: settings.expeditionPrinterDeviceId,
        sector: 'GENERAL'
      }
    ].filter((target): target is { deviceId: string; sector: string } =>
      Boolean(target.deviceId)
    )

    if (configuredTargets.length > 0) {
      const devices = await prisma.device.findMany({
        where: {
          id: {
            in: configuredTargets.map(target => target.deviceId)
          },
          organizationId,
          status: 'ACTIVE',
          type: {
            in: [DeviceType.PRINTER, DeviceType.SK210]
          }
        }
      })

      const devicesById = new Map(
        devices.map(device => [device.id, device])
      )

      const printTargets: PrintTarget[] = []

      for (const target of configuredTargets) {
          const device = devicesById.get(target.deviceId)

          if (!device) {
            continue
          }

          const connectionType =
            getMetadataValue(device.metadata, 'connectionType') ??
            (device.type === DeviceType.SK210 ? 'SK210_LOCAL' : 'TCP_IP')

          printTargets.push({
            source: 'DEVICE' as const,
            id: device.id,
            deviceId: device.id,
            printerId: null,
            sector: mapPrintingSectorToPrinterSector(target.sector),
            connectionType,
            paperSize: resolvePaperSize({
              targetPaperSize: getMetadataValue(device.metadata, 'paperSize'),
              settingsPaperSize: settings.paperSize
            })
          })
      }

      return printTargets
    }

    const devices = await prisma.device.findMany({
      where: {
        organizationId,
        ...(eventId ? { eventId } : {}),
        ...(storeId ? { storeId } : {}),
        status: 'ACTIVE',
        type: {
          in: [DeviceType.PRINTER, DeviceType.SK210]
        }
      }
    })

    return devices.map(device => {
      const metadataSector = getMetadataValue(device.metadata, 'printerSector')
      const connectionType =
        getMetadataValue(device.metadata, 'connectionType') ??
        (device.type === DeviceType.SK210 ? 'SK210_LOCAL' : 'TCP_IP')

      return {
        source: 'DEVICE' as const,
        id: device.id,
        deviceId: device.id,
        printerId: null,
        sector: isPrinterSector(metadataSector)
          ? metadataSector
          : mapPrintingSectorToPrinterSector(metadataSector),
        connectionType,
        paperSize: resolvePaperSize({
          targetPaperSize: getMetadataValue(device.metadata, 'paperSize'),
          settingsPaperSize: settings.paperSize
        })
      }
    })
  }

  private buildJobs({
    domain,
    orderId,
    eventId,
    onlineOrderId,
    storeId,
    printMode,
    targets,
    basePayload,
    items
  }: {
    domain: OrderPrintDomain
    orderId: string | null
    eventId: string | null
    onlineOrderId: string | null
    storeId: string | null
    printMode: 'FULL_ORDER' | 'BY_SECTOR' | 'BOTH'
    targets: PrintTarget[]
    basePayload: Prisma.InputJsonObject
    items: PrintableItem[]
  }) {
    const jobsToCreate: JobToCreate[] = []
    const domainOrderId = orderId ?? onlineOrderId

    if (!domainOrderId) {
      return jobsToCreate
    }

    const fullOrderTargets = findTargetsBySector(targets, 'FULL_ORDER')

    for (const target of fullOrderTargets) {
      jobsToCreate.push({
        eventId,
        orderId,
        storeId,
        onlineOrderId,
        idempotencyKey: [
          'auto',
          domain,
          domainOrderId,
          target.source,
          target.id,
          'FULL_ORDER'
        ].join(':'),
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
          items
        }
      })
    }

    if (printMode === 'BY_SECTOR' || printMode === 'BOTH') {
      const sectors: JobSector[] = ['BAR', 'KITCHEN']

      for (const sector of sectors) {
        const sectorItems = items.filter(item => item.sector === sector)

        if (sectorItems.length === 0) {
          continue
        }

        const sectorTargets = findTargetsBySector(targets, sector)

        for (const target of sectorTargets) {
          jobsToCreate.push({
            eventId,
            orderId,
            storeId,
            onlineOrderId,
            idempotencyKey: [
              'auto',
              domain,
              domainOrderId,
              target.source,
              target.id,
              sector
            ].join(':'),
            printerId: target.printerId,
            deviceId: target.deviceId,
            sector,
            payload: {
              ...basePayload,
              type: 'SECTOR',
              title: sector === 'BAR' ? 'COMANDA BAR' : 'COMANDA COZINHA',
              sector,
              printerSector: sector,
              connectionType: target.connectionType,
              printTargetSource: target.source,
              printTargetId: target.id,
              paperSize: target.paperSize,
              items: sectorItems
            }
          })
        }
      }
    }

    return jobsToCreate
  }
}
