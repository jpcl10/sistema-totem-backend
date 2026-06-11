import { prisma } from '../../../lib/prisma.js'

interface CreatePrinterServiceRequest {
  organizationId: string
  eventId: string

  name: string

  sector:
    | 'FULL_ORDER'
    | 'BAR'
    | 'KITCHEN'

  connectionType:
    | 'TCP_IP'
    | 'SK210_LOCAL'

  ipAddress: string
  port: number

  paperSize:
    | '58mm'
    | '80mm'

  active: boolean
}

export class CreatePrinterService {
  async execute({
    organizationId,
    eventId,

    name,
    sector,
    connectionType,

    ipAddress,
    port,

    paperSize,
    active
  }: CreatePrinterServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const printer =
      await prisma.eventPrinter.create({
        data: {
          eventId,

          name,
          sector,
          connectionType,

          ipAddress,
          port,

          paperSize,
          active
        }
      })

    return {
      printer
    }
  }
}