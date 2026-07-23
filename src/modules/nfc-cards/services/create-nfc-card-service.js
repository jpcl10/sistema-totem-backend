import { prisma } from '../../../lib/prisma.js';
import { AuditAction, NfcCardType, NfcCardStatus } from '@prisma/client';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
export class CreateNfcCardService {
    async execute({ organizationId, userId, eventId, uid, code, holderName, type, metadata }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const normalizedUid = uid.trim().toUpperCase();
        const existingCard = await prisma.nfcCard.findFirst({
            where: {
                uid: normalizedUid
            }
        });
        if (existingCard) {
            throw new Error('NFC card with this UID already exists');
        }
        const nfcCard = await prisma.nfcCard.create({
            data: {
                organizationId,
                eventId,
                uid: normalizedUid,
                code,
                holderName,
                type: type || NfcCardType.CUSTOMER,
                status: NfcCardStatus.ACTIVE,
                balanceInCents: 0,
                metadata
            }
        });
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId,
            eventId,
            userId,
            entity: 'NfcCard',
            entityId: nfcCard.id,
            action: AuditAction.NFC_CARD_CREATED,
            description: 'Cartão NFC criado',
            metadata: {
                nfcCardId: nfcCard.id,
                uid: normalizedUid,
                type: type || NfcCardType.CUSTOMER
            }
        });
        return {
            nfcCard
        };
    }
}
