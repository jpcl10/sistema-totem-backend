import { prisma } from '../../../lib/prisma.js'
import { logger } from '../../../lib/logger.js'
import { NfcReadSource } from '@prisma/client'

interface IdentifyNfcCardServiceRequest {
  eventSlug: string
  uid: string
}

export class IdentifyNfcCardService {
  async execute({ eventSlug, uid }: IdentifyNfcCardServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        slug: eventSlug,
        active: true
      }
    })

    if (!event) {
      return { found: false }
    }

    const normalizedUid = uid.trim().toUpperCase().replace(/:/g, '')

    const nfcCard = await prisma.nfcCard.findFirst({
      where: {
        uid: normalizedUid,
        eventId: event.id,
        organizationId: event.organizationId
      }
    })

    if (!nfcCard) {
      return { found: false }
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
      })
    } catch (error) {
      logger.warn(
        { 
          error, 
          organizationId: event.organizationId, 
          eventId: event.id, 
          nfcCardId: nfcCard.id 
        }, 
        'Failed to create NfcCardRead record from totem'
      )
    }

    if (nfcCard.status !== 'ACTIVE') {
      return {
        found: true,
        blocked: true
      }
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
    }
  }
}
