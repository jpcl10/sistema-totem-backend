import { prisma } from '../../../lib/prisma.js';
export class ListNfcCardsService {
    async execute({ organizationId, eventId, type, status }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const nfcCards = await prisma.nfcCard.findMany({
            where: {
                eventId,
                organizationId,
                ...(type && { type }),
                ...(status && { status })
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return {
            nfcCards
        };
    }
}
