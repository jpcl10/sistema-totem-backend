import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';
import { NfcReadSource } from '@prisma/client';
import { resolveCanonicalPublicEvent, resolveLegacyPublicEventSlug } from '../../events/services/public-event-resolver.js';
export class IdentifyNfcCardService {
    async execute({ eventSlug, organizationSlug, uid }) {
        const resolvedEvent = organizationSlug
            ? await resolveCanonicalPublicEvent({
                organizationSlug,
                eventSlug
            })
            : await resolveLegacyPublicEventSlug(eventSlug);
        const event = await prisma.event.findFirst({
            where: {
                id: resolvedEvent.id,
                organizationId: resolvedEvent.organizationId,
                active: true
            }
        });
        if (!event) {
            return { found: false };
        }
        const normalizedUid = uid.trim().toUpperCase().replace(/:/g, '');
        const nfcCard = await prisma.nfcCard.findFirst({
            where: {
                uid: normalizedUid,
                eventId: event.id,
                organizationId: event.organizationId
            }
        });
        if (!nfcCard) {
            return { found: false };
        }
        // Try to create NfcCardRead record
        try {
            await prisma.nfcCardRead.create({
                data: {
                    organizationId: event.organizationId,
                    eventId: event.id,
                    nfcCardId: nfcCard.id,
                    uid: normalizedUid,
                    source: NfcReadSource.TOTEM
                }
            });
        }
        catch (error) {
            logger.warn({
                error,
                organizationId: event.organizationId,
                eventId: event.id,
                nfcCardId: nfcCard.id
            }, 'Failed to create NfcCardRead record from totem');
        }
        if (nfcCard.status !== 'ACTIVE') {
            return {
                found: true,
                blocked: true
            };
        }
        return {
            found: true,
            customer: {
                cardId: nfcCard.id,
                uid: normalizedUid,
                code: nfcCard.code,
                name: nfcCard.holderName,
                type: nfcCard.type
            }
        };
    }
}
