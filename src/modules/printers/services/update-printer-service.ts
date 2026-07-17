import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'

interface UpdatePrinterServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  printerId: string

  name?: string

  sector?:
    | 'FULL_ORDER'
    | 'BAR'
    | 'KITCHEN'

  connectionType?:
    | 'TCP_IP'
    | 'SK210_LOCAL'

  ipAddress?: string
  port?: number

  paperSize?:
    | '58mm'
    | '80mm'

  active?: boolean
}

export class UpdatePrinterService {
  async execute({
    organizationId,
    printerId,

    name,
    sector,
    connectionType,

    ipAddress,
    port,

    paperSize,
    active
  }: UpdatePrinterServiceRequest) {
    const printer =
      await prisma.eventPrinter.findFirst({
        where: {
          id: printerId,
          event: {
            organizationId
          }
        }
      })

    if (!printer) {
      throw new Error('Printer not found')
    }

    const updatedPrinter =
      await prisma.eventPrinter.update({
        where: {
          id: printerId
        },
        data: {
          ...(name !== undefined && {
            name
          }),

          ...(sector !== undefined && {
            sector
          }),

          ...(connectionType !== undefined && {
            connectionType
          }),

          ...(ipAddress !== undefined && {
            ipAddress
          }),

          ...(port !== undefined && {
            port
          }),

          ...(paperSize !== undefined && {
            paperSize
          }),

          ...(active !== undefined && {
            active
          })
        }
      })

    return {
      printer: updatedPrinter
    }
  }
}
