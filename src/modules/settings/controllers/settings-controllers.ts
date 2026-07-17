import { FastifyReply, FastifyRequest } from 'fastify'
import {
  BrandingTheme,
  DeliveryFeeRuleType,
  SettingsChannel,
  SettingsContextType
} from '@prisma/client'

import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js'
import { GetSettingsService } from '../services/get-settings-service.js'
import { UpdateGeneralSettingsService } from '../services/update-general-settings-service.js'
import { UpdateBrandingSettingsService } from '../services/update-branding-settings-service.js'
import { BusinessHoursService } from '../services/business-hours-service.js'
import { SettingsResolverService } from '../services/settings-resolver-service.js'
import { OnlineStoreSettingsService } from '../services/online-store-settings-service.js'
import { PrintingSettingsService } from '../services/printing-settings-service.js'
import {
  businessHourExceptionParamsSchema,
  createBusinessHourExceptionSchema,
  createDeliveryFeeRuleSchema,
  deliveryFeeRuleParamsSchema,
  getBusinessHoursQuerySchema,
  getSettingsQuerySchema,
  storeSettingsQuerySchema,
  updateBrandingSettingsSchema,
  updateBusinessHourExceptionSchema,
  updateDeliveryFeeRuleSchema,
  updateDeliverySettingsSchema,
  updatePrintingSettingsSchema,
  updateGeneralSettingsSchema,
  updateOnlineOrderSettingsSchema,
  upsertBusinessHoursSchema
} from '../schemas/settings-schemas.js'

function handleSettingsError(
  error: unknown,
  reply: FastifyReply
) {
  if (!(error instanceof Error)) {
    throw error
  }

  if (
    error.message.includes('not found') ||
    error.message.includes('Organization not found')
  ) {
    return reply.status(404).send({
      message: error.message
    })
  }

  return reply.status(400).send({
    message: error.message
  })
}

export async function getSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query =
      getSettingsQuerySchema.parse(request.query)

    const organizationId =
      getTenantOrganizationId(request)

    const { settings } =
      await new GetSettingsService().execute({
        organizationId,
        storeId: query.storeId,
        eventId: query.eventId,
        deviceId: query.deviceId,
        channel: query.channel as SettingsChannel | undefined,
        date: query.date
      })

    return reply.send(settings)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function updateGeneralSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body =
      updateGeneralSettingsSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const { general } =
      await new UpdateGeneralSettingsService().execute({
        organizationId,
        userId: request.user.sub,
        data: body
      })

    return reply.send({
      general
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function getBrandingSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId =
      getTenantOrganizationId(request)

    const { settings } =
      await new GetSettingsService().execute({
        organizationId
      })

    return reply.send({
      branding: settings.branding,
      effective: settings.effective.branding
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function updateBrandingSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body =
      updateBrandingSettingsSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const { branding } =
      await new UpdateBrandingSettingsService().execute({
        organizationId,
        userId: request.user.sub,
        data: {
          ...body,
          theme: body.theme as BrandingTheme | undefined
        }
      })

    return reply.send({
      branding
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function getPrintingSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new PrintingSettingsService().getOrDefaults({
        organizationId
      })

    return reply.send({
      settings: result.settings,
      effective: result.effective,
      source: result.source
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function updatePrintingSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body =
      updatePrintingSettingsSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new PrintingSettingsService().update({
        organizationId,
        userId: request.user.sub,
        data: body
      })

    return reply.send(result)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function getBusinessHoursController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query =
      getBusinessHoursQuerySchema.parse(request.query)

    const organizationId =
      getTenantOrganizationId(request)

    const { businessHours } =
      await new BusinessHoursService().list({
        organizationId,
        contextType: query.contextType as SettingsContextType | undefined,
        storeId: query.storeId,
        channel: query.channel as SettingsChannel | undefined
      })

    return reply.send({
      businessHours
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function upsertBusinessHoursController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body =
      upsertBusinessHoursSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const { businessHours } =
      await new BusinessHoursService().upsert({
        organizationId,
        userId: request.user.sub,
        contextType: body.contextType as SettingsContextType,
        storeId: body.storeId,
        channel: body.channel as SettingsChannel,
        hours: body.hours
      })

    return reply.send({
      businessHours
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function createBusinessHourExceptionController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body =
      createBusinessHourExceptionSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const { exception } =
      await new BusinessHoursService().createException({
        organizationId,
        userId: request.user.sub,
        storeId: body.storeId,
        channel: body.channel as SettingsChannel,
        date: body.date,
        isClosed: body.isClosed,
        is24Hours: body.is24Hours,
        opensAt: body.opensAt,
        closesAt: body.closesAt,
        reason: body.reason
      })

    return reply.status(201).send({
      exception
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function updateBusinessHourExceptionController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { exceptionId } =
      businessHourExceptionParamsSchema.parse(request.params)

    const body =
      updateBusinessHourExceptionSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const { exception } =
      await new BusinessHoursService().updateException({
        organizationId,
        userId: request.user.sub,
        exceptionId,
        storeId: body.storeId,
        channel: body.channel as SettingsChannel | undefined,
        date: body.date,
        isClosed: body.isClosed,
        is24Hours: body.is24Hours,
        opensAt: body.opensAt,
        closesAt: body.closesAt,
        reason: body.reason
      })

    return reply.send({
      exception
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function deleteBusinessHourExceptionController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { exceptionId } =
      businessHourExceptionParamsSchema.parse(request.params)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new BusinessHoursService().deleteException({
        organizationId,
        userId: request.user.sub,
        exceptionId
      })

    return reply.send(result)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function getEffectiveSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query =
      getSettingsQuerySchema.parse(request.query)

    const organizationId =
      getTenantOrganizationId(request)

    const effective =
      await new SettingsResolverService().execute({
        organizationId,
        storeId: query.storeId,
        eventId: query.eventId,
        deviceId: query.deviceId,
        channel: query.channel as SettingsChannel | undefined,
        date: query.date
      })

    return reply.send({
      effective
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function getOnlineOrderSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query =
      storeSettingsQuerySchema.parse(request.query)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new OnlineStoreSettingsService().getOrDefaults({
        organizationId,
        storeId: query.storeId
      })

    return reply.send({
      storeId: query.storeId,
      settings: result.settings,
      effective: result.effective,
      source: result.source
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function updateOnlineOrderSettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query =
      storeSettingsQuerySchema.parse(request.query)

    const body =
      updateOnlineOrderSettingsSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new OnlineStoreSettingsService().updateOnlineOrders({
        organizationId,
        userId: request.user.sub,
        storeId: query.storeId,
        data: body
      })

    return reply.send(result)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function getDeliverySettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query =
      storeSettingsQuerySchema.parse(request.query)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new OnlineStoreSettingsService().getOrDefaults({
        organizationId,
        storeId: query.storeId
      })

    return reply.send({
      storeId: query.storeId,
      settings: result.settings,
      delivery: {
        deliveryEnabled: result.effective.deliveryEnabled,
        pickupEnabled: result.effective.pickupEnabled,
        counterEnabled: result.effective.counterEnabled,
        dineInEnabled: result.effective.dineInEnabled,
        estimatedDeliveryMinutes: result.effective.estimatedDeliveryMinutes,
        freeDeliveryAboveInCents: result.effective.freeDeliveryAboveInCents,
        defaultDeliveryFeeInCents: result.effective.defaultDeliveryFeeInCents,
        requireDeliveryAddress: result.effective.requireDeliveryAddress
      },
      source: result.source
    })
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function updateDeliverySettingsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query =
      storeSettingsQuerySchema.parse(request.query)

    const body =
      updateDeliverySettingsSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new OnlineStoreSettingsService().updateDelivery({
        organizationId,
        userId: request.user.sub,
        storeId: query.storeId,
        data: body
      })

    return reply.send(result)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function listDeliveryFeeRulesController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query =
      storeSettingsQuerySchema.parse(request.query)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new OnlineStoreSettingsService().listDeliveryRules({
        organizationId,
        storeId: query.storeId
      })

    return reply.send(result)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function createDeliveryFeeRuleController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body =
      createDeliveryFeeRuleSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new OnlineStoreSettingsService().createDeliveryRule({
        organizationId,
        userId: request.user.sub,
        data: {
          ...body,
          type: body.type as DeliveryFeeRuleType
        }
      })

    return reply.status(201).send(result)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function updateDeliveryFeeRuleController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { ruleId } =
      deliveryFeeRuleParamsSchema.parse(request.params)

    const body =
      updateDeliveryFeeRuleSchema.parse(request.body)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new OnlineStoreSettingsService().updateDeliveryRule({
        organizationId,
        userId: request.user.sub,
        ruleId,
        data: {
          ...body,
          type: body.type as DeliveryFeeRuleType | undefined
        }
      })

    return reply.send(result)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}

export async function deleteDeliveryFeeRuleController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { ruleId } =
      deliveryFeeRuleParamsSchema.parse(request.params)

    const organizationId =
      getTenantOrganizationId(request)

    const result =
      await new OnlineStoreSettingsService().deleteDeliveryRule({
        organizationId,
        userId: request.user.sub,
        ruleId
      })

    return reply.send(result)
  } catch (error) {
    return handleSettingsError(error, reply)
  }
}
