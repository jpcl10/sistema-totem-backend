import { prisma } from '../../../lib/prisma.js';
export class CreatePrinterService {
    async execute({ organizationId, eventId, name, sector, connectionType, ipAddress, port, paperSize, active }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const printer = await prisma.eventPrinter.create({
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
        });
        return {
            printer
        };
    }
}
