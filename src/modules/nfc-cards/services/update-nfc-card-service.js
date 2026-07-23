import { prisma } from '../../../lib/prisma.js';
import { AuditAction } from '@prisma/client';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
export class UpdateNfcCardService {
    async execute({ organizationId, userId, eventId, nfcCardId, code, holderName, type, status, metadata }) {
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
                eventId,
                organizationId
            }
        });
        if (!nfcCard) {
            throw new Error('NFC card not found');
        }
        const updatedNfcCard = await prisma.nfcCard.update({
            where: {
                id: nfcCardId
            },
            data: {
                code,
                holderName,
                type,
                status,
                metadata
            }
        });
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId: nfcCard.organizationId,
            eventId,
            userId,
            entity: 'NfcCard',
            entityId: updatedNfcCard.id,
            action: AuditAction.NFC_CARD_UPDATED,
            description: 'Cartão NFC atualizado',
            metadata: {
                nfcCardId: updatedNfcCard.id,
                changes: {
                    code,
                    holderName,
                    type,
                    status
                }
            }
        });
        return {
            nfcCard: updatedNfcCard
        };
    }
}
