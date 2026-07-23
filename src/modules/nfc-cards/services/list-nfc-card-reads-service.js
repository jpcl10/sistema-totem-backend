import { prisma } from '../../../lib/prisma.js';
export class ListNfcCardReadsService {
    async execute({ organizationId, eventId, nfcCardId, page, limit }) {
        // Verify that the event belongs to the organization
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        // Verify that the NFC card belongs to the organization and event
        const nfcCard = await prisma.nfcCard.findFirst({
            where: {
                id: nfcCardId,
                organizationId,
                eventId
            }
        });
        if (!nfcCard) {
            throw new Error('NFC card not found');
        }
        const skip = (page - 1) * limit;
        const [reads, total] = await Promise.all([
            prisma.nfcCardRead.findMany({
                where: {
                    nfcCardId,
                    organizationId,
                    eventId
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    device: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    nfcCard: {
                        select: {
                            id: true,
                            uid: true,
                            code: true,
                            holderName: true,
                            type: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit,
                skip
            }),
            prisma.nfcCardRead.count({
                where: {
                    nfcCardId,
                    organizationId,
                    eventId
                }
            })
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            reads,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        };
    }
}
