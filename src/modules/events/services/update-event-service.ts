import { prisma } from '../../../lib/prisma.js'
import { AuditAction } from '@prisma/client'
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js'

interface UpdateEventServiceRequest {
  eventId: string
  organizationId: string
  userId: string

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
  pixPaymentExpirationMinutes?: number

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
    userId,

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
    pixPaymentExpirationMinutes,

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

    // Determine which fields were changed
    const changedFields: string[] = []
    const auditMetadata: Record<string, any> = {}

    // Check name
    if (name !== undefined && name !== event.name) {
      changedFields.push('name')
      auditMetadata.name = name
    } else {
      auditMetadata.name = event.name
    }

    // Check slug
    if (slug !== undefined && slug !== event.slug) {
      changedFields.push('slug')
      auditMetadata.slug = slug
    } else {
      auditMetadata.slug = event.slug
    }

    // Check pixEnabled
    if (pixEnabled !== undefined && pixEnabled !== event.pixEnabled) {
      changedFields.push('pixEnabled')
      auditMetadata.pixEnabled = pixEnabled
    } else {
      auditMetadata.pixEnabled = event.pixEnabled
    }

    // Check pixPaymentExpirationMinutes
    if (
      pixPaymentExpirationMinutes !== undefined &&
      pixPaymentExpirationMinutes !== event.pixPaymentExpirationMinutes
    ) {
      changedFields.push('pixPaymentExpirationMinutes')
      auditMetadata.pixPaymentExpirationMinutes = pixPaymentExpirationMinutes
    } else {
      auditMetadata.pixPaymentExpirationMinutes = event.pixPaymentExpirationMinutes
    }

    // Check printingEnabled
    if (
      printingEnabled !== undefined &&
      printingEnabled !== event.printingEnabled
    ) {
      changedFields.push('printingEnabled')
      auditMetadata.printingEnabled = printingEnabled
    } else {
      auditMetadata.printingEnabled = event.printingEnabled
    }

    // Check autoPrintEnabled
    if (
      autoPrintEnabled !== undefined &&
      autoPrintEnabled !== event.autoPrintEnabled
    ) {
      changedFields.push('autoPrintEnabled')
      auditMetadata.autoPrintEnabled = autoPrintEnabled
    } else {
      auditMetadata.autoPrintEnabled = event.autoPrintEnabled
    }

    // Add changed fields to metadata
    if (changedFields.length > 0) {
      auditMetadata.changedFields = changedFields
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

        ...(pixPaymentExpirationMinutes !== undefined && {
          pixPaymentExpirationMinutes
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

    // Create audit log
    const createAuditLogService = new CreateAuditLogService()
    await createAuditLogService.execute({
      organizationId: organizationId,
      eventId: eventId,
      userId,
      entity: 'Event',
      entityId: updatedEvent.id,
      action: AuditAction.EVENT_UPDATED,
      description: 'Evento atualizado',
      metadata: auditMetadata
    })

    return {
      event: updatedEvent
    }
  }
}