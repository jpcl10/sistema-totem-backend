import { prisma } from '../../../lib/prisma.js'

interface CreatePrintJobsForOrderServiceRequest {
  orderId: string
}

type JobSector = 'BAR' | 'KITCHEN'

type PrinterSector =
  | 'FULL_ORDER'
  | 'BAR'
  | 'KITCHEN'

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

    // So imprime quando o pedido ja esta liberado financeiramente.
    if (
      order.paymentStatus !== 'PAID' &&
      order.paymentStatus !== 'NOT_REQUIRED'
    ) {
      return {
        printJobs: []
      }
    }

    /**
     * Segurança:
     * Se esse pedido já tem print jobs criados,
     * não cria novamente para evitar comandas duplicadas.
     */
    if (order.printJobs.length > 0) {
      return {
        printJobs: order.printJobs
      }
    }

    /**
     * Se impressão estiver desligada no evento,
     * não cria nenhuma comanda.
     */
    if (!order.event.printingEnabled) {
      return {
        printJobs: []
      }
    }

    const printers = await prisma.eventPrinter.findMany({
      where: {
        eventId: order.eventId,
        active: true
      }
    })

    function findPrintersBySector(
      sector: PrinterSector
    ) {
      return printers.filter(
        printer => printer.sector === sector
      )
    }

    const jobsToCreate: {
      eventId: string
      orderId: string
      printerId: string | null
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

    /**
     * 1. COMANDA COMPLETA / RESUMO DO CLIENTE
     *
     * Usada principalmente pela impressora interna do totem SK210.
     * Também pode ser usada por uma impressora externa configurada
     * como FULL_ORDER.
     */
    const fullOrderPrinters =
      findPrintersBySector('FULL_ORDER')

    for (const printer of fullOrderPrinters) {
      jobsToCreate.push({
        eventId: order.eventId,
        orderId: order.id,
        printerId: printer.id,

        /**
         * O banco exige BAR ou KITCHEN.
         * Para pedido completo, usamos KITCHEN apenas como valor técnico.
         * O tipo real fica no payload.printerSector = FULL_ORDER.
         */
        sector: 'KITCHEN',

        payload: {
          ...basePayload,
          type: 'FULL_ORDER',
          title: 'PEDIDO COMPLETO',
          printerSector: 'FULL_ORDER',
          connectionType: printer.connectionType,
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

    /**
     * 2. COMANDAS POR SETOR
     *
     * Só cria para BAR/COZINHA se o modo do evento permitir.
     */
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

        const sectorPrinters =
          findPrintersBySector(sector)

        for (const printer of sectorPrinters) {
          jobsToCreate.push({
            eventId: order.eventId,
            orderId: order.id,
            printerId: printer.id,
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
              connectionType: printer.connectionType,
              items: sectorItems.map(item => ({
                name: item.productName,
                quantity: item.quantity
              }))
            }
          })
        }
      }
    }

    /**
     * 3. MODO FULL_ORDER SEM IMPRESSORA FULL_ORDER
     *
     * Se o evento estiver em FULL_ORDER mas não tiver impressora
     * FULL_ORDER cadastrada, não cria nada.
     *
     * Isso evita criar print job sem impressora vinculada.
     */

    const printJobs = []

    for (const job of jobsToCreate) {
      const printJob =
        await prisma.eventPrintJob.create({
          data: job,
          include: {
            printer: true
          }
        })

      printJobs.push(printJob)
    }

    return {
      printJobs
    }
  }
}
