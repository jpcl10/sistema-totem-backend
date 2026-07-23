import { prisma } from '../../../lib/prisma.js';
export class ListDevicesService {
    async execute({ organizationId }) {
        const devices = await prisma.device.findMany({
            where: {
                organizationId
            },
            include: {
                event: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                store: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            devices
        };
    }
}
