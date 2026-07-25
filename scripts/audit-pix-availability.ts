import 'dotenv/config'
import { PrismaClient, PaymentProvider, PaymentContextType, DeviceType } from '@prisma/client'
import { PaymentSettingsResolver } from '../src/modules/payment-settings/payment-settings-resolver.js'
import { GetMercadoPagoStatusService } from '../src/modules/payment-settings/services/get-mercado-pago-status-service.js'
import { GetCheckoutPaymentSettingsService } from '../src/modules/payments/services/get-checkout-payment-settings-service.js'
import { GetTotemReadinessService } from '../src/modules/events/services/get-totem-readiness-service.js'
import { decryptPaymentCredentials } from '../src/modules/payment-settings/payment-credentials-crypto.js'

const prisma = new PrismaClient()

interface Args {
  organizationId?: string
  organizationSlug?: string
  eventId?: string
  eventSlug?: string
  storeId?: string
  storeSlug?: string
  deviceId?: string
  deviceCode?: string
  orderId?: string
  fix?: boolean
  help?: boolean
}

type ContextType = 'EVENT' | 'ONLINE_STORE' | 'TOTEM' | 'UNKNOWN'

type AuditContext = {
  organizationId?: string
  eventId?: string
  storeId?: string
  deviceId?: string
  contextType: ContextType
}

type AuditResult = {
  context: AuditContext
  organizationSettings: any
  contextSettings: any
  legacyProviderSettings: any
  modernProviderCredential: any
  mercadoPagoStatus: any
  effectiveSettings: any
  checkoutPaymentSettings: any
  totemReadiness: any
  firstFalseCondition: string
  fixPlan?: string
  fixApplied?: string
}

function parseArgs(): Args {
  const args: Args = {}
  const raw = process.argv.slice(2)

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i]
    switch (arg) {
      case '--organization-id':
      case '--organizationId':
        args.organizationId = raw[++i]
        break
      case '--organization-slug':
      case '--organizationSlug':
        args.organizationSlug = raw[++i]
        break
      case '--event-id':
      case '--eventId':
        args.eventId = raw[++i]
        break
      case '--event-slug':
      case '--eventSlug':
        args.eventSlug = raw[++i]
        break
      case '--store-id':
      case '--storeId':
        args.storeId = raw[++i]
        break
      case '--store-slug':
      case '--storeSlug':
        args.storeSlug = raw[++i]
        break
      case '--device-id':
      case '--deviceId':
        args.deviceId = raw[++i]
        break
      case '--device-code':
      case '--deviceCode':
        args.deviceCode = raw[++i]
        break
      case '--order-id':
      case '--orderId':
        args.orderId = raw[++i]
        break
      case '--fix':
        args.fix = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        console.warn(`Unknown argument: ${arg}`)
        args.help = true
        break
    }
  }

  return args
}

function formatBool(value: unknown) {
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  return String(value)
}

function padLine(label: string, value: string) {
  return `${label.padEnd(32)} ${value}`
}

function printSeparator() {
  console.log('='.repeat(80))
}

function printHelp() {
  console.log(`
Usage: npx tsx scripts/audit-pix-availability.ts [options]

Options:
  --organization-id <id>
  --organization-slug <slug>
  --event-id <id>
  --event-slug <slug>
  --store-id <id>
  --store-slug <slug>
  --device-id <id>
  --device-code <code>
  --order-id <id>
  --fix
  --help

Example:
  npx tsx scripts/audit-pix-availability.ts --event-id=cmrgkw4ev0001vwg89j5y35mz
`)
}

async function resolveContext(args: Args): Promise<AuditContext> {
  let organizationId = args.organizationId
  let eventId = args.eventId
  let storeId = args.storeId
  let deviceId = args.deviceId

  if (args.organizationSlug && !organizationId) {
    const organization = await prisma.organization.findFirst({
      where: { slug: args.organizationSlug },
      select: { id: true }
    })
    organizationId = organization?.id ?? organizationId
  }

  if (args.eventSlug && !eventId) {
    const event = await prisma.event.findFirst({
      where: { slug: args.eventSlug },
      select: { id: true, organizationId: true }
    })
    eventId = event?.id ?? eventId
    organizationId = organizationId ?? event?.organizationId
  }

  if (args.storeSlug && !storeId) {
    const store = await prisma.onlineStore.findFirst({
      where: { slug: args.storeSlug },
      select: { id: true, organizationId: true }
    })
    storeId = store?.id ?? storeId
    organizationId = organizationId ?? store?.organizationId
  }

  if (args.deviceCode && !deviceId) {
    const device = await prisma.device.findFirst({
      where: { code: args.deviceCode },
      select: { id: true, organizationId: true, eventId: true }
    })
    deviceId = device?.id ?? deviceId
    organizationId = organizationId ?? device?.organizationId
    eventId = eventId ?? device?.eventId ?? undefined
  }

  if (args.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: args.orderId },
      select: { eventId: true, event: { select: { organizationId: true } } }
    })
    eventId = order?.eventId ?? eventId
    organizationId = organizationId ?? order?.event?.organizationId
  }

  if (args.deviceId && !organizationId) {
    const device = await prisma.device.findUnique({
      where: { id: args.deviceId },
      select: { organizationId: true, eventId: true }
    })
    organizationId = organizationId ?? device?.organizationId
    eventId = eventId ?? device?.eventId ?? undefined
  }

  if (args.storeId && !organizationId) {
    const store = await prisma.onlineStore.findUnique({
      where: { id: args.storeId },
      select: { organizationId: true }
    })
    organizationId = organizationId ?? store?.organizationId
  }

  if (args.eventId && !organizationId) {
    const event = await prisma.event.findUnique({
      where: { id: args.eventId },
      select: { organizationId: true }
    })
    organizationId = organizationId ?? event?.organizationId
  }

  const contextType = eventId
    ? 'EVENT'
    : storeId
    ? 'ONLINE_STORE'
    : deviceId
    ? 'TOTEM'
    : 'UNKNOWN'

  return {
    organizationId,
    eventId,
    storeId,
    deviceId,
    contextType
  }
}

async function findCandidateContext(): Promise<AuditContext | null> {
  const credentials = await prisma.paymentProviderCredential.findMany({
    where: {
      provider: PaymentProvider.MERCADO_PAGO,
      active: true,
      encryptedCredentials: { not: null }
    },
    select: {
      organizationId: true,
      environment: true
    },
    orderBy: { updatedAt: 'desc' },
    take: 20
  })

  for (const credential of credentials) {
    const event = await prisma.event.findFirst({
      where: { organizationId: credential.organizationId, active: true },
      orderBy: { updatedAt: 'desc' },
      select: { id: true }
    })
    if (event) {
      return {
        organizationId: credential.organizationId,
        eventId: event.id,
        storeId: undefined,
        deviceId: undefined,
        contextType: 'EVENT'
      }
    }
  }

  return null
}

function getSourceLabel(status: any, legacy: any) {
  if (status.configured && status.accountReference) return 'modernCredential'
  if (legacy?.accessToken) return 'legacySettings'
  return 'unknown'
}

function getFirstFalseCondition(result: AuditResult): string {
  if (!result.mercadoPagoStatus.configured) {
    if (!result.modernProviderCredential.exists && !result.legacyProviderSettings?.accessToken) {
      return 'credencial inexistente ou token ausente'
    }
    if (!result.modernProviderCredential.exists && result.legacyProviderSettings?.accessToken) {
      return 'legacy accessToken ausente ou inacessível'
    }
    if (result.modernProviderCredential.exists && !result.modernProviderCredential.configured) {
      return 'credencial moderna não configurada ou token ausente'
    }
    return 'mercadoPagoStatus.configured = false'
  }

  if (!result.mercadoPagoStatus.pixEnabled) {
    if (result.organizationSettings?.pixEnabled === false) return 'organizationPaymentSettings.pixEnabled = false'
    if (result.legacyProviderSettings && result.legacyProviderSettings.pixEnabled === false) return 'legacyPaymentProviderSettings.pixEnabled = false'
    if (!result.modernProviderCredential.hasCredentialToken) return 'hasCredentialToken = false'
    return 'mercadoPagoStatus.pixEnabled = false'
  }

  if (!result.effectiveSettings?.methods?.pix) {
    if (result.contextSettings?.pixEnabledOverride === false) return 'contextPaymentSettings.pixEnabledOverride = false'
    if (result.organizationSettings?.pixEnabled === false) return 'organizationPaymentSettings.pixEnabled = false'
    return 'effectiveSettings.methods.pix = false'
  }

  return 'none'
}

function printAuditResult(result: AuditResult) {
  printSeparator()
  console.log('PIX AVAILABILITY AUDIT')
  printSeparator()
  console.log('Context:')
  console.log(padLine('organizationId =', String(result.context.organizationId)))
  console.log(padLine('eventId =', String(result.context.eventId)))
  console.log(padLine('storeId =', String(result.context.storeId)))
  console.log(padLine('deviceId =', String(result.context.deviceId)))
  console.log(padLine('contextType =', result.context.contextType))
  printSeparator()
  console.log('Organization settings:')
  console.log(padLine('pixEnabled =', formatBool(result.organizationSettings?.pixEnabled)))
  console.log(padLine('cashEnabled =', formatBool(result.organizationSettings?.cashEnabled)))
  console.log(padLine('cardEnabled =', formatBool(result.organizationSettings?.creditEnabled)))
  printSeparator()
  console.log('Context settings:')
  console.log(padLine('pixEnabledOverride =', formatBool(result.contextSettings?.pixEnabledOverride)))
  console.log(padLine('contextType =', String(result.contextSettings?.contextType)))
  console.log(padLine('contextId =', String(result.contextSettings?.eventId ?? result.contextSettings?.onlineStoreId ?? null)))
  printSeparator()
  console.log('Legacy provider settings:')
  console.log(padLine('enabled =', formatBool(result.legacyProviderSettings?.enabled)))
  console.log(padLine('pixEnabled =', formatBool(result.legacyProviderSettings?.pixEnabled)))
  console.log(padLine('hasAccessToken =', formatBool(Boolean(result.legacyProviderSettings?.accessToken))))
  printSeparator()
  console.log('Modern provider credential:')
  console.log(padLine('exists =', formatBool(result.modernProviderCredential.exists)))
  console.log(padLine('active =', formatBool(result.modernProviderCredential.active)))
  console.log(padLine('configured =', formatBool(result.modernProviderCredential.configured)))
  console.log(padLine('environment =', String(result.modernProviderCredential.environment)))
  console.log(padLine('hasCredentialToken =', formatBool(result.modernProviderCredential.hasCredentialToken)))
  console.log(padLine('credentialReadable =', formatBool(result.modernProviderCredential.credentialReadable)))
  printSeparator()
  console.log('Mercado Pago status:')
  console.log(padLine('configured =', formatBool(result.mercadoPagoStatus.configured)))
  console.log(padLine('pixEnabled =', formatBool(result.mercadoPagoStatus.pixEnabled)))
  console.log(padLine('source =', String(getSourceLabel(result.mercadoPagoStatus, result.legacyProviderSettings))))
  console.log(padLine('credentialReadable =', formatBool(result.mercadoPagoStatus.credentialReadable)))
  printSeparator()
  console.log('Effective settings:')
  console.log(padLine('methods.pix =', formatBool(result.effectiveSettings?.methods?.pix)))
  printSeparator()
  console.log('Final:')
  console.log(padLine('pixAutomaticAvailable =', formatBool(result.checkoutPaymentSettings?.mercadoPago?.pixAutomaticAvailable)))
  console.log(padLine('totem.pixAvailable =', formatBool(result.checkoutPaymentSettings?.totem?.pixAvailable)))
  console.log(padLine('totemUnavailableReason =', String(result.checkoutPaymentSettings?.totem?.unavailablePixReason ?? 'null')))
  printSeparator()
  console.log('FIRST FALSE CONDITION:')
  console.log(result.firstFalseCondition)
  if (result.fixPlan) {
    printSeparator()
    console.log('CHANGE PLAN:')
    console.log(result.fixPlan)
  }
  if (result.fixApplied) {
    printSeparator()
    console.log('FIX APPLIED:')
    console.log(result.fixApplied)
  }
  printSeparator()
}

function validateContext(context: AuditContext): asserts context is AuditContext & { organizationId: string } {
  if (!context.organizationId) {
    throw new Error('organizationId could not be resolved from the provided arguments')
  }
  if (!context.eventId && !context.storeId && !context.deviceId) {
    throw new Error('At least one of eventId, storeId, or deviceId must be resolvable')
  }
}

async function auditContext(args: Args): Promise<AuditResult> {
  let context = await resolveContext(args)

  if (!context.eventId && !context.storeId && !context.deviceId) {
    console.log('No explicit context provided, searching for a candidate with Mercado Pago credential...')
    const candidate = await findCandidateContext()
    if (!candidate) {
      throw new Error('No candidate context could be found automatically. Please pass --event-id, --store-id, or --device-id.')
    }
    context = candidate
  }

  validateContext(context)

  const organizationSettings = await prisma.organizationPaymentSettings.findUnique({
    where: { organizationId: context.organizationId }
  })

  const contextSettings = await prisma.contextPaymentSettings.findFirst({
    where: {
      organizationId: context.organizationId,
      contextType: context.eventId ? PaymentContextType.EVENT : PaymentContextType.ONLINE_STORE,
      ...(context.eventId ? { eventId: context.eventId } : {}),
      ...(context.storeId ? { onlineStoreId: context.storeId } : {})
    }
  })

  const legacyProviderSettings = await prisma.paymentProviderSettings.findUnique({
    where: {
      organizationId_provider: {
        organizationId: context.organizationId,
        provider: PaymentProvider.MERCADO_PAGO
      }
    }
  })

  const modernProviderCredential = await prisma.paymentProviderCredential.findFirst({
    where: {
      organizationId: context.organizationId,
      provider: PaymentProvider.MERCADO_PAGO,
      active: true,
      environment: organizationSettings?.environment ?? 'PRODUCTION'
    },
    orderBy: { updatedAt: 'desc' }
  })

  let decryptedCredential: any = null
  let credentialReadable = true
  if (modernProviderCredential?.encryptedCredentials) {
    try {
      decryptedCredential = decryptPaymentCredentials(modernProviderCredential.encryptedCredentials)
    } catch (error) {
      credentialReadable = false
    }
  }

  const hasCredentialToken = Boolean(decryptedCredential?.accessToken?.trim())

  const mercadoPagoStatus = await new GetMercadoPagoStatusService().execute({
    organizationId: context.organizationId
  })

  const effectiveSettings = await new PaymentSettingsResolver().resolve({
    organizationId: context.organizationId,
    contextType: context.eventId ? PaymentContextType.EVENT : PaymentContextType.ONLINE_STORE,
    eventId: context.eventId ?? null,
    onlineStoreId: context.storeId ?? null
  })

  const checkoutPaymentSettingsResult = context.eventId
    ? await new GetCheckoutPaymentSettingsService().execute({
        eventId: context.eventId,
        context: 'TOTEM'
      })
    : null

  let totemReadiness = null
  if (context.eventId) {
    try {
      totemReadiness = await new GetTotemReadinessService().execute({
        organizationId: context.organizationId,
        eventId: context.eventId
      })
    } catch (error) {
      totemReadiness = { error: error instanceof Error ? error.message : String(error) }
    }
  }

  const checkoutPaymentSettings = checkoutPaymentSettingsResult?.checkoutPaymentSettings ?? null

  const result: AuditResult = {
    context,
    organizationSettings,
    contextSettings,
    legacyProviderSettings,
    modernProviderCredential: {
      exists: Boolean(modernProviderCredential),
      active: modernProviderCredential?.active ?? false,
      configured: Boolean(modernProviderCredential?.encryptedCredentials),
      environment: modernProviderCredential?.environment ?? organizationSettings?.environment ?? 'PRODUCTION',
      hasCredentialToken,
      credentialReadable
    },
    mercadoPagoStatus,
    effectiveSettings,
    checkoutPaymentSettings,
    totemReadiness,
    firstFalseCondition: 'unknown'
  }

  result.firstFalseCondition = getFirstFalseCondition(result)

  if (args.fix) {
    const planParts: string[] = []
    let applied = ''

    if (result.firstFalseCondition === 'organizationPaymentSettings.pixEnabled = false') {
      planParts.push('Set organizationPaymentSettings.pixEnabled to true for the affected organization.')
      await prisma.organizationPaymentSettings.update({
        where: { organizationId: context.organizationId },
        data: { pixEnabled: true }
      })
      applied = 'organizationPaymentSettings.pixEnabled updated to true'
    } else if (result.firstFalseCondition === 'contextPaymentSettings.pixEnabledOverride = false') {
      planParts.push('Clear contextPaymentSettings.pixEnabledOverride so the context inherits organization setting.')
      if (contextSettings) {
        await prisma.contextPaymentSettings.update({
          where: { id: contextSettings.id },
          data: { pixEnabledOverride: null }
        })
        applied = 'contextPaymentSettings.pixEnabledOverride set to null'
      }
    } else if (
      result.firstFalseCondition === 'legacyPaymentProviderSettings.pixEnabled = false' &&
      result.modernProviderCredential.exists &&
      result.organizationSettings?.pixEnabled === true
    ) {
      planParts.push('Update legacy paymentProviderSettings.pixEnabled to true to avoid blocking modern credential resolution.')
      await prisma.paymentProviderSettings.update({
        where: {
          organizationId_provider: {
            organizationId: context.organizationId,
            provider: PaymentProvider.MERCADO_PAGO
          }
        },
        data: { pixEnabled: true }
      })
      applied = 'legacy paymentProviderSettings.pixEnabled updated to true'
    }

    if (planParts.length > 0) {
      result.fixPlan = planParts.join(' ')
      result.fixApplied = applied || 'no fix applied'
    } else {
      result.fixPlan = 'No safe automatic fix available for the detected root cause.'
      result.fixApplied = 'no fix applied'
    }
  }

  return result
}

async function run() {
  const args = parseArgs()
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  try {
    const result = await auditContext(args)
    printAuditResult(result)
    if (args.fix && result.fixApplied === 'no fix applied') {
      console.warn('No automatic fix was applied. Review the audit output for the root cause.')
    }
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

run()
