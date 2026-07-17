import { prisma } from '../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface GetNfcCardByUidServiceRequest {
  organizationId: string
  userId: string
  eventId: string
  uid: string
}

export class GetNfcCardByUidService {
  async execute({
    organizationId,
    userId,
    eventId,
    uid
  }: GetNfcCardByUidServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const normalizedUid = uid.trim().toUpperCase()

    const nfcCard = await prisma.nfcCard.findFirst({
      where: {
        uid: normalizedUid,
        eventId,
        organizationId
      }
    })

    if (!nfcCard) {
      throw new Error('NFC card not found')
    }

    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: nfcCard.organizationId,
      eventId,
      userId,
      entity: 'NfcCard',
      entityId: nfcCard.id,
      action: AuditAction.NFC_CARD_READ,
      description: 'Cartão NFC consultado',
      metadata: {
        nfcCardId: nfcCard.id,
        uid: normalizedUid
      }
    })

    return {
      nfcCard
    }
  }
}
