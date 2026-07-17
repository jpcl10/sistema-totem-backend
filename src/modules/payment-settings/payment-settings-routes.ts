import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  AuditAction,
  PaymentContextType,
  PaymentEnvironment,
  PaymentProvider,
  Prisma,
  UserRole
} from '@prisma/client'
import { z } from 'zod'

import { prisma } from '../../lib/prisma.js'
import { verifyJWT } from '../auth/middlewares/verify-jwt.js'
import {
  getTenantOrganizationId,
  requireTenantContext
} from '../auth/middlewares/request-context.js'
import { CreateAuditLogService } from '../audit-logs/services/create-audit-log-service.js'
import { encryptPaymentCredentials } from './payment-credentials-crypto.js'
import { PaymentSettingsResolver } from './payment-settings-resolver.js'

function assertCanEdit(request: FastifyRequest) {
  const role = request.tenantContext?.actingUserRole ?? request.user.role

  if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only ADMIN or SUPER_ADMIN can edit payment settings')
  }
}

async function mapError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof Error)) {
    return reply.status(500).send({ message: 'Internal server error' })
  }

  if (error.message.includes('disabled at organization level')) {
    return reply.status(400).send({ message: error.message })
  }

  if (error.message.includes('Only ADMIN')) {
    return reply.status(403).send({ message: error.message })
  }

  if (error.message.includes('not found')) {
    return reply.status(404).send({ message: error.message })
  }

  return reply.status(500).send({ message: error.message })
}

const organizationBodySchema = z.object({
  pixEnabled: z.boolean().optional(),
  creditEnabled: z.boolean().optional(),
  debitEnabled: z.boolean().optional(),
  cashEnabled: z.boolean().optional(),
  nfcBalanceEnabled: z.boolean().optional(),
  defaultProvider: z.nativeEnum(PaymentProvider).optional(),
  pixExpirationMinutes: z.number().int().min(2).max(60).optional(),
  maxInstallments: z.number().int().min(1).max(24).optional(),
  environment: z.nativeEnum(PaymentEnvironment).optional()
})

const contextBodySchema = z.object({
  inheritOrganizationSettings: z.boolean().optional(),
  pixEnabledOverride: z.boolean().nullable().optional(),
  creditEnabledOverride: z.boolean().nullable().optional(),
  debitEnabledOverride: z.boolean().nullable().optional(),
  cashEnabledOverride: z.boolean().nullable().optional(),
  nfcBalanceEnabledOverride: z.boolean().nullable().optional(),
  maxInstallmentsOverride: z.number().int().min(1).max(24).nullable().optional()
})

const credentialsParamsSchema = z.object({
  provider: z.nativeEnum(PaymentProvider)
})

const credentialsBodySchema = z.object({
  environment: z.nativeEnum(PaymentEnvironment).default(PaymentEnvironment.PRODUCTION),
  active: z.boolean().optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  publicMetadata: z.record(z.string(), z.unknown()).nullable().optional()
})

const terminalBodySchema = z.object({
  provider: z.nativeEnum(PaymentProvider),
  externalTerminalId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1).nullable().optional(),
  eventId: z.string().trim().min(1).nullable().optional(),
  onlineStoreId: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
})

async function getOrganizationPaymentSettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const resolver = new PaymentSettingsResolver()
    return reply.send({
      paymentSettings: await resolver.resolve({ organizationId })
    })
  } catch (error) {
    return mapError(reply, error)
  }
}

async function patchOrganizationPaymentSettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    assertCanEdit(request)
    const organizationId = getTenantOrganizationId(request)
    const body = organizationBodySchema.parse(request.body)

    const settings = await prisma.organizationPaymentSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...body
      },
      update: body
    })

    await new CreateAuditLogService().execute({
      organizationId,
      userId: request.user.sub,
      entity: 'OrganizationPaymentSettings',
      entityId: settings.id,
      action: AuditAction.PAYMENT_SETTINGS_UPDATED,
      description: 'Configurações financeiras da organização atualizadas',
      metadata: body
    })

    const resolver = new PaymentSettingsResolver()
    return reply.send({
      paymentSettings: await resolver.resolve({ organizationId })
    })
  } catch (error) {
    return mapError(reply, error)
  }
}

async function patchProviderCredentials(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    assertCanEdit(request)
    const organizationId = getTenantOrganizationId(request)
    const { provider } = credentialsParamsSchema.parse(request.params)
    const body = credentialsBodySchema.parse(request.body)
    const encrypted = body.credentials
      ? encryptPaymentCredentials(body.credentials)
      : null

    const credential = await prisma.paymentProviderCredential.upsert({
      where: {
        organizationId_provider_environment: {
          organizationId,
          provider,
          environment: body.environment
        }
      },
      create: {
        organizationId,
        provider,
        environment: body.environment,
        encryptedCredentials: encrypted?.encryptedPayload ?? null,
        keyVersion: encrypted?.keyVersion ?? null,
        publicMetadata:
          body.publicMetadata === null
            ? Prisma.JsonNull
            : body.publicMetadata as Prisma.InputJsonValue | undefined,
        active: body.active ?? true
      },
      update: {
        ...(encrypted && {
          encryptedCredentials: encrypted.encryptedPayload,
          keyVersion: encrypted.keyVersion
        }),
        ...(body.publicMetadata !== undefined && {
          publicMetadata:
            body.publicMetadata === null
              ? Prisma.JsonNull
              : body.publicMetadata as Prisma.InputJsonValue
        }),
        ...(body.active !== undefined && {
          active: body.active
        })
      }
    })

    await new CreateAuditLogService().execute({
      organizationId,
      userId: request.user.sub,
      entity: 'PaymentProviderCredential',
      entityId: credential.id,
      action: AuditAction.PAYMENT_PROVIDER_SETTINGS_UPDATED,
      description: 'Credenciais de provedor de pagamento atualizadas',
      metadata: {
        provider,
        environment: body.environment,
        active: credential.active,
        configured: Boolean(credential.encryptedCredentials)
      }
    })

    return reply.send({
      credential: {
        id: credential.id,
        provider: credential.provider,
        environment: credential.environment,
        active: credential.active,
        configured: Boolean(credential.encryptedCredentials),
        publicMetadata: credential.publicMetadata,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt
      }
    })
  } catch (error) {
    return mapError(reply, error)
  }
}

async function getEffectivePaymentSettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const organizationId = getTenantOrganizationId(request)
    const query = z.object({
      contextType: z.nativeEnum(PaymentContextType).optional(),
      eventId: z.string().optional(),
      onlineStoreId: z.string().optional()
    }).parse(request.query)

    const resolver = new PaymentSettingsResolver()
    return reply.send({
      paymentSettings: await resolver.resolve({
        organizationId,
        contextType: query.contextType,
        eventId: query.eventId,
        onlineStoreId: query.onlineStoreId
      })
    })
  } catch (error) {
    return mapError(reply, error)
  }
}

async function upsertEventContextSettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    assertCanEdit(request)
    const organizationId = getTenantOrganizationId(request)
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params)
    const body = contextBodySchema.parse(request.body)

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true }
    })

    if (!event) throw new Error('Event not found')

    const resolver = new PaymentSettingsResolver()
    await resolver.assertContextCanEnableMethods({
      organizationId,
      ...body
    })

    const existing = await prisma.contextPaymentSettings.findFirst({
      where: {
        organizationId,
        contextType: PaymentContextType.EVENT,
        eventId,
        onlineStoreId: null
      }
    })

    if (existing) {
      await prisma.contextPaymentSettings.update({
        where: { id: existing.id },
        data: body
      })
    } else {
      await prisma.contextPaymentSettings.create({
        data: {
          organizationId,
          contextType: PaymentContextType.EVENT,
          eventId,
          ...body
        }
      })
    }

    return reply.send({
      paymentSettings: await resolver.resolve({
        organizationId,
        contextType: PaymentContextType.EVENT,
        eventId
      })
    })
  } catch (error) {
    return mapError(reply, error)
  }
}

async function upsertOnlineStoreContextSettings(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    assertCanEdit(request)
    const organizationId = getTenantOrganizationId(request)
    const { storeId } = z.object({ storeId: z.string() }).parse(request.params)
    const body = contextBodySchema.parse(request.body)

    const store = await prisma.onlineStore.findFirst({
      where: { id: storeId, organizationId },
      select: { id: true }
    })

    if (!store) throw new Error('Online store not found')

    const resolver = new PaymentSettingsResolver()
    await resolver.assertContextCanEnableMethods({
      organizationId,
      ...body
    })

    const existing = await prisma.contextPaymentSettings.findFirst({
      where: {
        organizationId,
        contextType: PaymentContextType.ONLINE_STORE,
        eventId: null,
        onlineStoreId: storeId
      }
    })

    if (existing) {
      await prisma.contextPaymentSettings.update({
        where: { id: existing.id },
        data: body
      })
    } else {
      await prisma.contextPaymentSettings.create({
        data: {
          organizationId,
          contextType: PaymentContextType.ONLINE_STORE,
          onlineStoreId: storeId,
          ...body
        }
      })
    }

    return reply.send({
      paymentSettings: await resolver.resolve({
        organizationId,
        contextType: PaymentContextType.ONLINE_STORE,
        onlineStoreId: storeId
      })
    })
  } catch (error) {
    return mapError(reply, error)
  }
}

async function upsertPaymentTerminal(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    assertCanEdit(request)
    const organizationId = getTenantOrganizationId(request)
    const body = terminalBodySchema.parse(request.body)

    if (body.deviceId) {
      const device = await prisma.device.findFirst({
        where: { id: body.deviceId, organizationId },
        select: { id: true }
      })
      if (!device) throw new Error('Device not found')
    }

    const terminal = await prisma.paymentTerminal.upsert({
      where: {
        organizationId_provider_externalTerminalId: {
          organizationId,
          provider: body.provider,
          externalTerminalId: body.externalTerminalId
        }
      },
      create: {
        organizationId,
        provider: body.provider,
        externalTerminalId: body.externalTerminalId,
        deviceId: body.deviceId ?? null,
        eventId: body.eventId ?? null,
        onlineStoreId: body.onlineStoreId ?? null,
        active: body.active ?? true,
        metadata: body.metadata as Prisma.InputJsonValue | undefined
      },
      update: {
        deviceId: body.deviceId ?? null,
        eventId: body.eventId ?? null,
        onlineStoreId: body.onlineStoreId ?? null,
        active: body.active ?? true,
        metadata: body.metadata as Prisma.InputJsonValue | undefined
      }
    })

    await new CreateAuditLogService().execute({
      organizationId,
      userId: request.user.sub,
      deviceId: terminal.deviceId,
      entity: 'PaymentTerminal',
      entityId: terminal.id,
      action: AuditAction.PAYMENT_TERMINAL_LINKED,
      description: 'Terminal de pagamento vinculado',
      metadata: {
        provider: terminal.provider,
        externalTerminalId: terminal.externalTerminalId,
        deviceId: terminal.deviceId
      }
    })

    return reply.send({ terminal })
  } catch (error) {
    return mapError(reply, error)
  }
}

async function listPaymentTerminals(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const organizationId = getTenantOrganizationId(request)
  const terminals = await prisma.paymentTerminal.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' }
  })

  return reply.send({ terminals })
}

export async function paymentSettingsRoutes(app: FastifyInstance) {
  app.get('/payment-settings/organization', {
    preHandler: [verifyJWT, requireTenantContext]
  }, getOrganizationPaymentSettings)

  app.patch('/payment-settings/organization', {
    preHandler: [verifyJWT, requireTenantContext]
  }, patchOrganizationPaymentSettings)

  app.patch('/payment-settings/providers/:provider/credentials', {
    preHandler: [verifyJWT, requireTenantContext]
  }, patchProviderCredentials)

  app.get('/payment-settings/effective', {
    preHandler: [verifyJWT, requireTenantContext]
  }, getEffectivePaymentSettings)

  app.patch('/payment-settings/events/:eventId', {
    preHandler: [verifyJWT, requireTenantContext]
  }, upsertEventContextSettings)

  app.patch('/payment-settings/online-stores/:storeId', {
    preHandler: [verifyJWT, requireTenantContext]
  }, upsertOnlineStoreContextSettings)

  app.get('/payment-terminals', {
    preHandler: [verifyJWT, requireTenantContext]
  }, listPaymentTerminals)

  app.post('/payment-terminals', {
    preHandler: [verifyJWT, requireTenantContext]
  }, upsertPaymentTerminal)
}
