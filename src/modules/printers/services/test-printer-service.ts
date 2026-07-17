import { prisma } from '../../../lib/prisma.js'
import { UserRole } from '@prisma/client'
import { sendToThermalPrinter } from '../../../lib/thermal-printer.js'

interface TestPrinterServiceRequest {
  organizationId: string
  userRole: UserRole
  selectedOrganizationId?: string
  printerId: string
}

export class TestPrinterService {
  async execute({
    organizationId,
    printerId
  }: TestPrinterServiceRequest) {
    const printer = await prisma.eventPrinter.findFirst({
      where: {
        id: printerId,
        active: true,
        event: {
          organizationId
        }
      },
      include: {
        event: true
      }
    })

    if (!printer) {
      throw new Error('Printer not found')
    }

    const content = `
================
TESTE IMPRESSORA
================

Evento: ${printer.event.name}
Impressora: ${printer.name}
Setor: ${printer.sector}
Papel: ${printer.paperSize}

Conexao OK.
`

    await sendToThermalPrinter({
      ipAddress: printer.ipAddress,
      port: printer.port,
      content
    })

    return {
      success: true
    }
  }
}
