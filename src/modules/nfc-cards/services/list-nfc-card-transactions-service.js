import { prisma } from '../../../lib/prisma.js';
export class ListNfcCardTransactionsService {
    async execute({ organizationId, eventId, nfcCardId, page, limit }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
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
        const [transactions, total] = await Promise.all([
            prisma.nfcCardTransaction.findMany({
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
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit,
                skip
            }),
            prisma.nfcCardTransaction.count({
                where: {
                    nfcCardId,
                    organizationId,
                    eventId
                }
            })
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        };
    }
}
