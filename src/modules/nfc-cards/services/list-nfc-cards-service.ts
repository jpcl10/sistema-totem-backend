import { prisma } from '../../../lib/prisma.js'
import { NfcCardType, NfcCardStatus } from '@prisma/client'

interface ListNfcCardsServiceRequest {
  organizationId: string
  eventId: string
  type?: NfcCardType
  status?: NfcCardStatus
}

export class ListNfcCardsService {
  async execute({
    organizationId,
    eventId,
    type,
    status
  }: ListNfcCardsServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
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
    })

    return {
      nfcCards
    }
  }
}
