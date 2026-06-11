import { prisma } from '../../../lib/prisma.js'

import { PrinterFactory } from '../../../lib/printers/printer-factory.js'

type PrintPayload = {
  type?: string
  title?: string
  eventName?: string
  orderNumber?: number
  customerName?: string | null
  createdAt?: string | Date
  totalInCents?: number
  paperSize?: string
  sector?: string
  items?: {
    name: string
    quantity: number
    sector?: string
  }[]
}

export class ProcessPrintJobsService {
  async execute() {
    const jobs = await prisma.eventPrintJob.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        printer: true,
        event: true,
        order: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 10
    })

    for (const job of jobs) {
      try {
        /**
         * Se a impressão estiver desativada no evento,
         * não processa agora.
         *
         * Mantém PENDING para não perder a comanda.
         */
        if (!job.event.printingEnabled) {
          continue
        }

        /**
         * Se impressão automática estiver desativada,
         * não processa automaticamente.
         *
         * Mantém PENDING para impressão manual ou futura.
         */
        if (!job.event.autoPrintEnabled) {
          continue
        }

        /**
         * Se o job não tiver impressora vinculada,
         * aí sim é erro de configuração.
         */
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

          continue
        }

        /**
         * Impressora inativa não deve receber impressão.
         */
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

          continue
        }

        /**
         * IMPORTANTE:
         *
         * Impressora SK210_LOCAL não deve ser impressa pelo backend.
         * Ela será processada pelo app Android instalado no totem.
         *
         * Então o backend deixa o job como PENDING.
         * O app Android vai buscar em:
         *
         * GET /device/print-jobs/pending
         *
         * Depois o app marca como:
         *
         * PATCH /device/print-jobs/:id/printed
         * ou
         * PATCH /device/print-jobs/:id/error
         */
        if (job.printer.connectionType === 'SK210_LOCAL') {
          continue
        }

        /**
         * A partir daqui, o backend só processa TCP/IP.
         */
        const printerDriver = PrinterFactory.getPrinter(job.printer)

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

          continue
        }

        const payload = job.payload as PrintPayload

        let content = ''

        content += '==============================\n'
        content += `${payload.title ?? 'PEDIDO'}\n`
        content += '==============================\n\n'

        if (payload.eventName) {
          content += `${payload.eventName}\n`
        }

        if (payload.orderNumber) {
          content += `Pedido: #${payload.orderNumber}\n`
        }

        if (payload.customerName) {
          content += `Cliente: ${payload.customerName}\n`
        }

        if (payload.sector) {
          content += `Setor: ${payload.sector}\n`
        }

        content += '\n'
        content += '------------------------------\n'

        for (const item of payload.items ?? []) {
          content += `${item.quantity}x ${item.name}\n`
        }

        content += '------------------------------\n\n'

        if (payload.totalInCents !== undefined) {
          const total = payload.totalInCents / 100

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
      } catch (error) {
        await prisma.eventPrintJob.update({
          where: {
            id: job.id
          },
          data: {
            status: 'ERROR',
            errorMessage:
              error instanceof Error
                ? error.message
                : 'Print error'
          }
        })
      }
    }

    return {
      success: true
    }
  }
}