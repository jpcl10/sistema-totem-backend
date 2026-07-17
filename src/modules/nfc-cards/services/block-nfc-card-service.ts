import { prisma } from '../../../lib/prisma.js'
import { AuditAction, NfcCardStatus } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface BlockNfcCardServiceRequest {
  organizationId: string
  userId: string
  eventId: string
  nfcCardId: string
}

export class BlockNfcCardService {
  async execute({
    organizationId,
    userId,
    eventId,
    nfcCardId
  }: BlockNfcCardServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const nfcCard = await prisma.nfcCard.findFirst({
      where: {
        id: nfcCardId,
        eventId,
        organizationId
      }
    })

    if (!nfcCard) {
      throw new Error('NFC card not found')
    }

    if (nfcCard.status === NfcCardStatus.BLOCKED) {
      throw new Error('NFC card is already blocked')
    }

    const blockedNfcCard = await prisma.nfcCard.update({
      where: {
        id: nfcCardId
      },
      data: {
        status: NfcCardStatus.BLOCKED
      }
    })

    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: nfcCard.organizationId,
      eventId,
      userId,
      entity: 'NfcCard',
      entityId: blockedNfcCard.id,
      action: AuditAction.NFC_CARD_BLOCKED,
      description: 'Cartão NFC bloqueado',
      metadata: {
        nfcCardId: blockedNfcCard.id
      }
    })

    return {
      nfcCard: blockedNfcCard
    }
  }
}
