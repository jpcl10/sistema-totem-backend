import { prisma } from '../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { logger } from '../../../lib/logger.js'
import { PrinterFactory } from '../../../lib/printers/printer-factory.js'
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

export class ProcessPrintJobsService {
  async execute() {
    const jobs = await prisma.eventPrintJob.findMany({
      where: {
        status: 'PENDING',

        /**
         * IMPORTANTE:
         * Jobs com deviceId são processados pelo APK/SK210.
         * O worker do backend só deve processar impressoras legadas.
         */
        deviceId: null
      },
      include: {
        printer: true,
        event: true,
        store: true,
        order: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 10
    })

    const createAuditLogService = new CreateAuditLogService()

    for (const job of jobs) {
      try {
        const payload =
          job.payload as PrintPayload

        const organizationId =
          job.event?.organizationId ?? job.store?.organizationId

        if (!organizationId) {
          continue
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
          continue
        }

        if (!job.printer) {
          await prisma.eventPrintJob.update({
            where: {
              id: job.id
            },
            data: {
              status: 'ERROR',
              errorMessage: 'Printer not configured'
            }
          })

          logger.error({ printJobId: job.id, error: 'Printer not configured' }, 'Falha na impressão: impressora não configurada')

          // Audit: PRINT_JOB_ERROR
          await createAuditLogService.execute({
            organizationId: job.event?.organizationId ?? job.store!.organizationId,
            eventId: job.eventId,
            entity: 'PrintJob',
            entityId: job.id,
            action: AuditAction.PRINT_JOB_ERROR,
            description: 'Falha na impressão: impressora não configurada',
            metadata: {
              printJobId: job.id,
              erro: 'Printer not configured'
            }
          })

          continue
        }

        if (!job.printer.active) {
          await prisma.eventPrintJob.update({
            where: {
              id: job.id
            },
            data: {
              status: 'ERROR',
              errorMessage: 'Printer is inactive'
            }
          })

          logger.error({ printJobId: job.id, error: 'Printer is inactive' }, 'Falha na impressão: impressora inativa')

          // Audit: PRINT_JOB_ERROR
          await createAuditLogService.execute({
            organizationId: job.event?.organizationId ?? job.store!.organizationId,
            eventId: job.eventId,
            entity: 'PrintJob',
            entityId: job.id,
            action: AuditAction.PRINT_JOB_ERROR,
            description: 'Falha na impressão: impressora inativa',
            metadata: {
              printJobId: job.id,
              erro: 'Printer is inactive'
            }
          })

          continue
        }

        if (job.printer.connectionType === 'SK210_LOCAL') {
          continue
        }

        const printerDriver =
          PrinterFactory.getPrinter(job.printer)

        if (!printerDriver) {
          await prisma.eventPrintJob.update({
            where: {
              id: job.id
            },
            data: {
              status: 'ERROR',
              errorMessage:
                'Printer driver not available for this connection type'
            }
          })

          logger.error({ printJobId: job.id, error: 'Printer driver not available for this connection type' }, 'Falha na impressão: driver não disponível')

          // Audit: PRINT_JOB_ERROR
          await createAuditLogService.execute({
            organizationId: job.event?.organizationId ?? job.store!.organizationId,
            eventId: job.eventId,
            entity: 'PrintJob',
            entityId: job.id,
            action: AuditAction.PRINT_JOB_ERROR,
            description: 'Falha na impressão: driver não disponível',
            metadata: {
              printJobId: job.id,
              erro: 'Printer driver not available for this connection type'
            }
          })

          continue
        }

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
          const total =
            payload.totalInCents / 100

          content += `Total: R$ ${total
            .toFixed(2)
            .replace('.', ',')}\n`
        }

        content += '\n\n\n'

        await printerDriver.print({
          ipAddress: job.printer.ipAddress,
          port: job.printer.port,
          content
        })

        await prisma.eventPrintJob.update({
          where: {
            id: job.id
          },
          data: {
            status: 'PRINTED',
            printedAt: new Date(),
            errorMessage: null
          }
        })

        // Audit: PRINT_JOB_PRINTED
        await createAuditLogService.execute({
          organizationId: job.event?.organizationId ?? job.store!.organizationId,
          eventId: job.eventId,
          entity: 'PrintJob',
          entityId: job.id,
          action: AuditAction.PRINT_JOB_PRINTED,
          description: 'Impressão concluída',
          metadata: {
            printJobId: job.id,
            orderId: job.orderId,
            printerId: job.printerId,
            sector: job.sector,
            deviceId: job.deviceId
          }
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Print error'

        logger.error({ printJobId: job.id, error: errorMessage }, 'Falha na impressão')

        await prisma.eventPrintJob.update({
          where: {
            id: job.id
          },
          data: {
            status: 'ERROR',
            errorMessage
          }
        })

        // Audit: PRINT_JOB_ERROR
        await createAuditLogService.execute({
          organizationId: job.event?.organizationId ?? job.store!.organizationId,
          eventId: job.eventId,
          entity: 'PrintJob',
          entityId: job.id,
          action: AuditAction.PRINT_JOB_ERROR,
          description: `Falha na impressão: ${errorMessage}`,
          metadata: {
            printJobId: job.id,
            erro: errorMessage
          }
        })
      }
    }

    return {
      success: true
    }
  }
}
