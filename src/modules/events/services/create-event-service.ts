import { prisma } from '../../../lib/prisma.js'

interface CreateEventServiceRequest {
  organizationId: string
  name: string
  slug: string
  primaryColor?: string
  secondaryColor?: string
  logoUrl?: string
  startsAt?: Date
  endsAt?: Date
}

export class CreateEventService {
  async execute({
    organizationId,
    name,
    slug,
    primaryColor,
    secondaryColor,
    logoUrl,
    startsAt,
    endsAt
  }: CreateEventServiceRequest) {
    const eventWithSameSlug = await prisma.event.findFirst({
      where: {
        organizationId,
        slug
      }
    })

    if (eventWithSameSlug) {
      throw new Error('Event already exists')
    }

    const event = await prisma.event.create({
      data: {
        organizationId,
        name,
        slug,
        primaryColor,
        secondaryColor,
        logoUrl,
        startsAt,
        endsAt
      }
    })

    return {
      event
    }
  }
}