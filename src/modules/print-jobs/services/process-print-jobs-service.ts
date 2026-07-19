import { AuditAction, PrintJobStatus } from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { logger } from '../../../lib/logger.js'
import { PrinterFactory } from '../../../lib/printers/printer-factory.js'
import { printProcessingConfig } from '../../../shared/config/redis.js'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'
import {
  EffectivePrintingSettings,
  PrintingSourceKey
} from '../../settings/services/printing-settings-service.js'
import { SettingsResolverService } from '../../settings/services/settings-resolver-service.js'

type PrintPayload = {
  domain?: string
  type?: string
  title?: string
  eventName?: string
  storeName?: string
  orderNumber?: number
  source?: string
  manualSale?: boolean
  customerName?: string | null
  customerPhone?: string | null
  createdAt?: string | Date
  totalInCents?: number
  subtotalInCents?: number
  deliveryFeeInCents?: number
  paperSize?: string
  sector?: string
  fulfillment?: string
  deliveryAddress?: {
    address?: string | null
    number?: string | null
    neighborhood?: string | null
    complement?: string | null
    reference?: string | null
  } | null
  paymentStatus?: string
  paymentMethod?: string | null
  notes?: string | null
  items?: {
    name: string
    quantity: number
    sector?: string
    notes?: string | null
    options?: {
      groupName: string
      optionName: string
    }[]
  }[]
}

type ProcessOneRequest = {
  printJobId: string
  workerId: string
  attemptNumber?: number
  maxAttempts?: number
}

function getPrintingSource(payload: PrintPayload): PrintingSourceKey {
  if (payload.domain === 'ONLINE_ORDER') {
    return payload.source === 'ADMIN'
      ? 'MANUAL_STORE'
      : 'ONLINE_STORE'
  }

  if (payload.source === 'TOTEM') {
    return 'TOTEM'
  }

  if (payload.source === 'MANUAL_EVENT' || payload.manualSale) {
    return 'MANUAL_EVENT'
  }

  return 'EVENT'
}

function canAutoPrint({
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

function buildPrintContent(payload: PrintPayload) {
  let content = ''

  content += '==============================\n'
  content += `${payload.title ?? 'PEDIDO'}\n`
  content += '==============================\n\n'

  if (payload.eventName || payload.storeName) {
    content += `${payload.eventName ?? payload.storeName}\n`
  }

  if (payload.manualSale) {
    content += 'VENDA MANUAL\n'
  }

  if (payload.source) {
    content += `Origem: ${payload.source}\n`
  }

  if (payload.createdAt) {
    const createdAt = new Date(payload.createdAt)
    content += `Data: ${createdAt.toLocaleString('pt-BR')}\n`
  }

  if (payload.orderNumber) {
    content += `Pedido: #${payload.orderNumber}\n`
  }

  if (payload.customerName) {
    content += `Cliente: ${payload.customerName}\n`
  }

  if (payload.customerPhone) {
    content += `Telefone: ${payload.customerPhone}\n`
  }

  if (payload.fulfillment) {
    content += `Atendimento: ${payload.fulfillment}\n`
  }

  if (payload.deliveryAddress) {
    const address = payload.deliveryAddress
    content += `Endereco: ${address.address ?? ''}, ${address.number ?? ''}\n`
    if (address.neighborhood) {
      content += `Bairro: ${address.neighborhood}\n`
    }
    if (address.complement) {
      content += `Compl.: ${address.complement}\n`
    }
    if (address.reference) {
      content += `Ref.: ${address.reference}\n`
    }
  }

  if (payload.paymentStatus || payload.paymentMethod) {
    content += `Pagamento: ${payload.paymentStatus ?? '-'}`
    if (payload.paymentMethod) {
      content += ` / ${payload.paymentMethod}`
    }
    content += '\n'
  }

  if (payload.sector) {
    content += `Setor: ${payload.sector}\n`
  }

  content += '\n'
  content += '------------------------------\n'

  for (const item of payload.items ?? []) {
    content += `${item.quantity}x ${item.name}\n`
    if (item.options && item.options.length > 0) {
      for (const opt of item.options) {
        content += `  + ${opt.optionName}\n`
      }
    }
    if (item.notes) {
      content += `  Obs: ${item.notes}\n`
    }
  }

  content += '------------------------------\n\n'

  if (payload.notes) {
    content += `Obs geral: ${payload.notes}\n`
  }

  if (payload.totalInCents !== undefined) {
    const total = payload.totalInCents / 100
    content += `Total: R$ ${total.toFixed(2).replace('.', ',')}\n`
  }

  content += '\n\n\n'

  return content
}

export class ProcessPrintJobsService {
  async execute(workerId = `legacy:${process.pid}`) {
    const jobs = await prisma.eventPrintJob.findMany({
      where: {
        status: {
          in: [PrintJobStatus.PENDING, PrintJobStatus.RETRY]
        },
        deviceId: null
      },
      select: {
        id: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 10
    })

    for (const job of jobs) {
      try {
        await this.processOne({
          printJobId: job.id,
          workerId,
          maxAttempts: 5
        })
      } catch (error) {
        logger.error(
          {
            printJobId: job.id,
            error: error instanceof Error ? error.message : 'Print worker error'
          },
          'Print worker error'
        )
      }
    }

    return {
      success: true,
      processedCount: jobs.length
    }
  }

  async processOne({
    printJobId,
    workerId,
    attemptNumber,
    maxAttempts = 5
  }: ProcessOneRequest) {
    const staleLockThreshold =
      new Date(Date.now() - printProcessingConfig.staleLockMs)
    let persistedAttemptNumber = attemptNumber ?? 1

    const existing = await prisma.eventPrintJob.findUnique({
      where: {
        id: printJobId
      },
      select: {
        id: true,
        status: true
      }
    })

    if (!existing) {
      return {
        skipped: true,
        reason: 'not_found' as const
      }
    }

    if (
      existing.status === PrintJobStatus.COMPLETED ||
      existing.status === PrintJobStatus.PRINTED ||
      existing.status === PrintJobStatus.CANCELLED
    ) {
      return {
        skipped: true,
        reason: 'terminal_status' as const
      }
    }

    const claim = await prisma.eventPrintJob.updateMany({
      where: {
        id: printJobId,
        OR: [
          {
            status: {
              in: [PrintJobStatus.PENDING, PrintJobStatus.RETRY]
            },
            OR: [
              {
                lockedAt: null
              },
              {
                lockedAt: {
                  lt: staleLockThreshold
                }
              }
            ]
          },
          {
            status: PrintJobStatus.PROCESSING,
            lockedAt: {
              lt: staleLockThreshold
            }
          }
        ]
      },
      data: {
        status: PrintJobStatus.PROCESSING,
        lockedAt: new Date(),
        lockedBy: workerId,
        lastAttemptAt: new Date(),
        attempts: {
          increment: 1
        }
      }
    })

    if (claim.count !== 1) {
      return {
        skipped: true,
        reason: 'not_claimed' as const
      }
    }

    try {
      const job = await prisma.eventPrintJob.findUnique({
        where: {
          id: printJobId
        },
        include: {
          printer: true,
          event: true,
          store: true,
          order: true
        }
      })

      if (!job) {
        return {
          skipped: true,
          reason: 'not_found_after_claim' as const
        }
      }

      persistedAttemptNumber = job.attempts

      const payload = job.payload as PrintPayload
      const organizationId = job.event?.organizationId ?? job.store?.organizationId

      if (!organizationId) {
        await this.failClaimedJob({
          printJobId,
          workerId,
          errorMessage: 'Organization not found for print job',
          finalFailure: true,
          organizationId: undefined,
          eventId: job.eventId
        })
        return
      }

      const effective =
        await new SettingsResolverService().execute({
          organizationId,
          eventId: job.eventId ?? undefined,
          storeId: job.storeId ?? undefined
        })

      if (!canAutoPrint({
        settings: effective.printing as EffectivePrintingSettings,
        source: getPrintingSource(payload)
      })) {
        await prisma.eventPrintJob.updateMany({
          where: {
            id: printJobId,
            lockedBy: workerId,
            status: PrintJobStatus.PROCESSING
          },
          data: {
            status: PrintJobStatus.PENDING,
            lockedAt: null,
            lockedBy: null
          }
        })

        return {
          skipped: true,
          reason: 'auto_print_disabled' as const
        }
      }

      if (!job.printer) {
        await this.failClaimedJob({
          printJobId,
          workerId,
          errorMessage: 'Printer not configured',
          finalFailure: true,
          organizationId,
          eventId: job.eventId
        })
        return
      }

      if (!job.printer.active) {
        await this.failClaimedJob({
          printJobId,
          workerId,
          errorMessage: 'Printer is inactive',
          finalFailure: true,
          organizationId,
          eventId: job.eventId
        })
        return
      }

      if (job.printer.connectionType === 'SK210_LOCAL') {
        await prisma.eventPrintJob.updateMany({
          where: {
            id: printJobId,
            lockedBy: workerId,
            status: PrintJobStatus.PROCESSING
          },
          data: {
            status: PrintJobStatus.PENDING,
            lockedAt: null,
            lockedBy: null
          }
        })
        return
      }

      const printerDriver = PrinterFactory.getPrinter(job.printer)

      if (!printerDriver) {
        await this.failClaimedJob({
          printJobId,
          workerId,
          errorMessage: 'Printer driver not available for this connection type',
          finalFailure: true,
          organizationId,
          eventId: job.eventId
        })
        return
      }

      await printerDriver.print({
        ipAddress: job.printer.ipAddress,
        port: job.printer.port,
        content: buildPrintContent(payload)
      })

      const completed = await prisma.eventPrintJob.updateMany({
        where: {
          id: printJobId,
          lockedBy: workerId,
          status: PrintJobStatus.PROCESSING
        },
        data: {
          status: PrintJobStatus.COMPLETED,
          printedAt: new Date(),
          completedAt: new Date(),
          errorMessage: null,
          lockedAt: null,
          lockedBy: null
        }
      })

      if (completed.count !== 1) {
        throw new Error('Print job lock was lost before completion')
      }

      await new CreateAuditLogService().execute({
        organizationId,
        eventId: job.eventId,
        entity: 'PrintJob',
        entityId: job.id,
        action: AuditAction.PRINT_JOB_PRINTED,
        description: 'Impressao concluida',
        metadata: {
          printJobId: job.id,
          orderId: job.orderId,
          printerId: job.printerId,
          sector: job.sector,
          deviceId: job.deviceId
        }
      })

      return {
        skipped: false
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Print error'
      const currentAttempt = attemptNumber ?? persistedAttemptNumber
      const finalFailure = currentAttempt >= maxAttempts

      await this.failClaimedJob({
        printJobId,
        workerId,
        errorMessage,
        finalFailure
      })

      throw error
    }
  }

  private async failClaimedJob({
    printJobId,
    workerId,
    errorMessage,
    finalFailure,
    organizationId,
    eventId
  }: {
    printJobId: string
    workerId: string
    errorMessage: string
    finalFailure: boolean
    organizationId?: string
    eventId?: string | null
  }) {
    const updated = await prisma.eventPrintJob.updateMany({
      where: {
        id: printJobId,
        lockedBy: workerId,
        status: PrintJobStatus.PROCESSING
      },
      data: {
        status: finalFailure ? PrintJobStatus.ERROR : PrintJobStatus.RETRY,
        errorMessage,
        failedAt: new Date(),
        lockedAt: null,
        lockedBy: null
      }
    })

    logger.error(
      {
        printJobId,
        error: errorMessage,
        finalFailure
      },
      'Falha na impressao'
    )

    if (updated.count !== 1 || !organizationId) {
      return
    }

    await new CreateAuditLogService().execute({
      organizationId,
      eventId,
      entity: 'PrintJob',
      entityId: printJobId,
      action: AuditAction.PRINT_JOB_ERROR,
      description: `Falha na impressao: ${errorMessage}`,
      metadata: {
        printJobId,
        erro: errorMessage,
        finalFailure
      }
    })
  }
}
