import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';
import { AuditAction, NfcCardStatus, NfcCardTransactionType } from '@prisma/client';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
export class AdjustNfcCardService {
    async execute({ organizationId, userId, eventId, nfcCardId, newBalanceInCents, description }) {
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
        if (nfcCard.status !== NfcCardStatus.ACTIVE) {
            throw new Error('NFC card is not active');
        }
        // Validate userId
        let validatedUserId = null;
        if (userId) {
            const user = await prisma.user.findFirst({
                where: {
                    id: userId,
                    organizationId
                }
            });
            if (user) {
                validatedUserId = userId;
            }
            else {
                logger.warn({ userId, organizationId }, 'Invalid userId for NfcCardTransaction, setting to null');
            }
        }
        const result = await prisma.$transaction(async (tx) => {
            const balanceBefore = nfcCard.balanceInCents;
            const balanceAfter = newBalanceInCents;
            const amountInCents = Math.abs(balanceAfter - balanceBefore);
            const updatedCard = await tx.nfcCard.update({
                where: { id: nfcCardId },
                data: {
                    balanceInCents: balanceAfter
                }
            });
            const transaction = await tx.nfcCardTransaction.create({
                data: {
                    organizationId,
                    eventId,
                    nfcCardId,
                    userId: validatedUserId,
                    type: NfcCardTransactionType.ADJUSTMENT,
                    amountInCents,
                    balanceBeforeInCents: balanceBefore,
                    balanceAfterInCents: balanceAfter,
                    description
                }
            });
            return {
                nfcCard: updatedCard,
                transaction
            };
        });
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId,
            eventId,
            userId: validatedUserId,
            entity: 'NfcCard',
            entityId: result.nfcCard.id,
            action: AuditAction.NFC_BALANCE_ADJUST,
            description: description || 'Ajuste de saldo',
            metadata: {
                nfcCardId: result.nfcCard.id,
                newBalanceInCents,
                balanceBefore: nfcCard.balanceInCents,
                balanceAfter: result.nfcCard.balanceInCents
            }
        });
        return result;
    }
}
