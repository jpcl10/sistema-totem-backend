import { prisma } from '../../../lib/prisma.js';
export class UpdateDeviceService {
    async execute({ organizationId, deviceId, name, eventId, locationName, status, type }) {
        const device = await prisma.device.findFirst({
            where: {
                id: deviceId,
                organizationId
            }
        });
        if (!device) {
            throw new Error('Device not found');
        }
        if (eventId) {
            const event = await prisma.event.findFirst({
                where: {
                    id: eventId,
                    organizationId
                }
            });
            if (!event) {
                throw new Error('Event not found');
            }
        }
        const updatedDevice = await prisma.device.update({
            where: {
                id: deviceId
            },
            data: {
                name: name?.trim(),
                eventId,
                locationName,
                status,
                type
            }
        });
        return {
            device: updatedDevice
        };
    }
}
