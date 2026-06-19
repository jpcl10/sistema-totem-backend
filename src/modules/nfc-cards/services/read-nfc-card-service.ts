import { prisma } from '../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface ReadNfcCardServiceRequest {
  organizationId: string
  userId: string
  eventId: string
  uid: string
}

export class ReadNfcCardService {
  async execute({
    organizationId,
    userId,
    eventId,
    uid
  }: ReadNfcCardServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    const normalizedUid = uid.trim().toUpperCase().replace(/:/g, '')

    const nfcCard = await prisma.nfcCard.findFirst({
      where: {
        uid: normalizedUid,
        eventId,
        organizationId
      }
    })

    if (!nfcCard) {
      return {
        found: false,
        message: 'Cartão NFC não cadastrado'
      }
    }

    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId,
      eventId,
      userId,
      entity: 'NfcCard',
      entityId: nfcCard.id,
      action: AuditAction.NFC_CARD_READ,
      metadata: {
        uid: normalizedUid,
        code: nfcCard.code,
        holderName: nfcCard.holderName,
        type: nfcCard.type,
        status: nfcCard.status
      }
    })

    if (nfcCard.status !== 'ACTIVE') {
      return {
        found: true,
        blocked: true,
        message: 'Cartão NFC bloqueado',
        nfcCard: {
          id: nfcCard.id,
          uid: normalizedUid,
          status: nfcCard.status
        }
      }
    }

    return {
      found: true,
      nfcCard: {
        id: nfcCard.id,
        uid: normalizedUid,
        code: nfcCard.code,
        holderName: nfcCard.holderName,
        type: nfcCard.type,
        status: nfcCard.status,
        balanceInCents: nfcCard.balanceInCents
      }
    }
  }
}
