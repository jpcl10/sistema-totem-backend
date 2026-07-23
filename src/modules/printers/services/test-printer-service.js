import { prisma } from '../../../lib/prisma.js';
import { sendToThermalPrinter } from '../../../lib/thermal-printer.js';
export class TestPrinterService {
    async execute({ organizationId, printerId }) {
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
        });
        if (!printer) {
            throw new Error('Printer not found');
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
`;
        await sendToThermalPrinter({
            ipAddress: printer.ipAddress,
            port: printer.port,
            content
        });
        return {
            success: true
        };
    }
}
