import { prisma } from '../../../lib/prisma.js';
export class GetDeviceService {
    async execute({ organizationId, deviceId }) {
        const device = await prisma.device.findFirst({
            where: {
                id: deviceId,
                organizationId
            },
            include: {
                event: true,
                store: true
            }
        });
        if (!device) {
            throw new Error('Device not found');
        }
        return {
            device
        };
    }
}
