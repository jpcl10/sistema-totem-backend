import { prisma } from '../../../lib/prisma.js'
import { logger } from '../../../lib/logger.js'
import { AuditAction, NfcReadSource } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface ReadNfcCardServiceRequest {
  organizationId: string
  userId: string
  eventId: string
  uid: string
  deviceId?: string | null
}

export class ReadNfcCardService {
  async execute({
    organizationId,
    userId,
    eventId,
    uid,
    deviceId
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

    // Validate optional fields
    let validatedUserId: string | null = null
    let validatedDeviceId: string | null = null

    if (userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          organizationId
        }
      })

      if (user) {
        validatedUserId = userId
      } else {
        logger.warn({ userId, organizationId }, 'Invalid userId for NfcCardRead, setting to null')
      }
    }

    if (deviceId) {
      const device = await prisma.device.findFirst({
        where: {
          id: deviceId,
          organizationId
        }
      })

      if (device) {
        validatedDeviceId = deviceId
      } else {
        logger.warn({ deviceId, organizationId }, 'Invalid deviceId for NfcCardRead, setting to null')
      }
    }

    // Try to create NfcCardRead record, don't fail if it doesn't work
    try {
      await prisma.nfcCardRead.create({
        data: {
          organizationId,
          eventId,
          nfcCardId: nfcCard.id,
          userId: validatedUserId,
          deviceId: validatedDeviceId,
          uid: normalizedUid,
          source: NfcReadSource.ADMIN_PANEL
        }
      })
    } catch (error) {
      logger.warn(
        { 
          error, 
          organizationId, 
          eventId, 
          nfcCardId: nfcCard.id, 
          userId: validatedUserId, 
          deviceId: validatedDeviceId 
        }, 
        'Failed to create NfcCardRead record'
      )
    }

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
