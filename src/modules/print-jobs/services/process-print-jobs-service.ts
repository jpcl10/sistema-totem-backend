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
        order: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 10
    })

    for (const job of jobs) {
      try {
        if (!job.event.printingEnabled) {
          continue
        }

        if (!job.event.autoPrintEnabled) {
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

          continue
        }

        const payload =
          job.payload as PrintPayload

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