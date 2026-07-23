import { prisma } from '../../../lib/prisma.js';
export class UpdatePrinterService {
    async execute({ organizationId, printerId, name, sector, connectionType, ipAddress, port, paperSize, active }) {
        const printer = await prisma.eventPrinter.findFirst({
            where: {
                id: printerId,
                event: {
                    organizationId
                }
            }
        });
        if (!printer) {
            throw new Error('Printer not found');
        }
        const updatedPrinter = await prisma.eventPrinter.update({
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
        });
        return {
            printer: updatedPrinter
        };
    }
}
