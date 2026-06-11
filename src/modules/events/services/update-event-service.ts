import { prisma } from '../../../lib/prisma.js'

interface UpdateEventServiceRequest {
  eventId: string
  organizationId: string

  name?: string
  slug?: string

  primaryColor?: string
  secondaryColor?: string

  logoUrl?: string | null
  bannerUrl?: string | null

  totemWelcomeMessage?: string | null
  totemBackgroundColor?: string | null
  totemTextColor?: string | null

  totemShowPrices?: boolean
  totemShowLowStock?: boolean
  totemRequireCustomerName?: boolean
  totemAutoResetSeconds?: number
  totemShowLogo?: boolean
  totemFullscreenRecommended?: boolean

  pixEnabled?: boolean
  pixKey?: string | null
  pixReceiverName?: string | null
  pixCity?: string | null
  pixInstructions?: string | null

  printingEnabled?: boolean
  autoPrintEnabled?: boolean

  printMode?:
    | 'FULL_ORDER'
    | 'BY_SECTOR'
    | 'BOTH'

  printerPaperSize?: '58mm' | '80mm'

  active?: boolean

  startsAt?: Date | null
  endsAt?: Date | null
}

export class UpdateEventService {
  async execute({
    eventId,
    organizationId,

    name,
    slug,

    primaryColor,
    secondaryColor,

    logoUrl,
    bannerUrl,

    totemWelcomeMessage,
    totemBackgroundColor,
    totemTextColor,

    totemShowPrices,
    totemShowLowStock,
    totemRequireCustomerName,
    totemAutoResetSeconds,
    totemShowLogo,
    totemFullscreenRecommended,

    pixEnabled,
    pixKey,
    pixReceiverName,
    pixCity,
    pixInstructions,

    printingEnabled,
    autoPrintEnabled,
    printMode,
    printerPaperSize,

    active,

    startsAt,
    endsAt
  }: UpdateEventServiceRequest) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizationId
      }
    })

    if (!event) {
      throw new Error('Event not found')
    }

    if (slug) {
      const eventWithSameSlug =
        await prisma.event.findFirst({
          where: {
            organizationId,
            slug,
            NOT: {
              id: eventId
            }
          }
        })

      if (eventWithSameSlug) {
        throw new Error('Slug already exists')
      }
    }

    const updatedEvent = await prisma.event.update({
      where: {
        id: eventId
      },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),

        ...(primaryColor !== undefined && { primaryColor }),
        ...(secondaryColor !== undefined && { secondaryColor }),

        ...(logoUrl !== undefined && { logoUrl }),
        ...(bannerUrl !== undefined && { bannerUrl }),

        ...(totemWelcomeMessage !== undefined && {
          totemWelcomeMessage
        }),

        ...(totemBackgroundColor !== undefined && {
          totemBackgroundColor
        }),

        ...(totemTextColor !== undefined && {
          totemTextColor
        }),

        ...(totemShowPrices !== undefined && {
          totemShowPrices
        }),

        ...(totemShowLowStock !== undefined && {
          totemShowLowStock
        }),

        ...(totemRequireCustomerName !== undefined && {
          totemRequireCustomerName
        }),

        ...(totemAutoResetSeconds !== undefined && {
          totemAutoResetSeconds
        }),

        ...(totemShowLogo !== undefined && {
          totemShowLogo
        }),

        ...(totemFullscreenRecommended !== undefined && {
          totemFullscreenRecommended
        }),

        ...(pixEnabled !== undefined && {
          pixEnabled
        }),

        ...(pixKey !== undefined && {
          pixKey
        }),

        ...(pixReceiverName !== undefined && {
          pixReceiverName
        }),

        ...(pixCity !== undefined && {
          pixCity
        }),

        ...(pixInstructions !== undefined && {
          pixInstructions
        }),

        ...(printingEnabled !== undefined && {
          printingEnabled
        }),

        ...(autoPrintEnabled !== undefined && {
          autoPrintEnabled
        }),

        ...(printMode !== undefined && {
          printMode
        }),

        ...(printerPaperSize !== undefined && {
          printerPaperSize
        }),

        ...(active !== undefined && { active }),

        ...(startsAt !== undefined && { startsAt }),
        ...(endsAt !== undefined && { endsAt })
      }
    })

    return {
      event: updatedEvent
    }
  }
}