import 'dotenv/config'
import { randomUUID } from 'node:crypto'

import { PaymentEnvironment, PaymentProvider } from '@prisma/client'

import { prisma } from '../src/lib/prisma.js'
import { mercadoPagoConfig } from '../src/shared/config/mercado-pago.js'
import { decryptPaymentCredentials } from '../src/modules/payment-settings/payment-credentials-crypto.js'

const organizationId =
  process.argv.find(arg => arg.startsWith('--organizationId='))?.split('=')[1] ??
  'cmra0xvea000rvwasonliufxu'

const shouldCreatePix =
  process.argv.includes('--create-pix')

type MercadoPagoCredentials = {
  accessToken?: string
  publicKey?: string
}

function maskSecret(value: string | null | undefined) {
  if (!value) return null
  if (value.length <= 12) return `${value.slice(0, 4)}...${value.slice(-4)}`
  return `${value.slice(0, 12)}...${value.slice(-4)}`
}

function safeString(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function bodyMessage(body: unknown) {
  if (!body || typeof body !== 'object') return safeString(body)
  const data = body as Record<string, unknown>
  return safeString(data.message ?? data.error ?? data.status_detail ?? data.code)
}

function inspectCredentialValue(value: string | null | undefined) {
  const original = value ?? ''
  const trimmed = original.trim()

  return {
    originalLength: original.length,
    trimmedLength: trimmed.length,
    containsWhitespace: /\s/.test(original),
    containsLineBreak: /[\r\n]/.test(original),
    containsQuotes: /['"]/.test(original),
    containsVariableName: /MERCADO_PAGO|ACCESS_TOKEN|PUBLIC_KEY/i.test(original),
    looksLikePlaceholder:
      /^(seu-|sua-|your-|placeholder|test-token|access-token)/i.test(trimmed),
    accessTokenLooksValid: /^(APP_USR|TEST)-/.test(trimmed),
    sanitized: trimmed
  }
}

function auditAuthorizationHeader(accessToken: string) {
  const authorizationHeader =
    accessToken ? `Bearer ${accessToken}` : ''
  const [scheme, tokenValue] =
    authorizationHeader.split(/\s+/, 2)

  return {
    authorizationHeaderPresent: Boolean(authorizationHeader),
    authorizationScheme: scheme || null,
    authorizationValueLength: tokenValue?.length ?? 0
  }
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init)
  const text = await response.text()

  let body: unknown = text

  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }

  return {
    response,
    body
  }
}

const organizationSettings =
  await prisma.organizationPaymentSettings.findUnique({
    where: { organizationId },
    select: {
      environment: true,
      pixEnabled: true
    }
  })

const environment =
  organizationSettings?.environment ?? PaymentEnvironment.PRODUCTION

const credential =
  await prisma.paymentProviderCredential.findFirst({
    where: {
      organizationId,
      provider: PaymentProvider.MERCADO_PAGO,
      environment,
      active: true
    },
    orderBy: {
      updatedAt: 'desc'
    },
    select: {
      id: true,
      active: true,
      environment: true,
      encryptedCredentials: true
    }
  })

let decryptionSucceeded = false
let decrypted: MercadoPagoCredentials | null = null
let decryptionError: string | null = null

if (credential?.encryptedCredentials) {
  try {
    decrypted =
      decryptPaymentCredentials<MercadoPagoCredentials>(
        credential.encryptedCredentials
      )
    decryptionSucceeded = true
  } catch (error) {
    decryptionError =
      error instanceof Error ? error.message : safeString(error)
  }
}

const accessTokenInspection =
  inspectCredentialValue(decrypted?.accessToken)
const publicKeyInspection =
  inspectCredentialValue(decrypted?.publicKey)

const sanitizedAccessToken =
  accessTokenInspection.sanitized

const authorizationAudit =
  auditAuthorizationHeader(sanitizedAccessToken)

const authUrl =
  'https://api.mercadopago.com/users/me'

let authResponse: {
  httpStatus: number | null
  mercadoPagoMessage: string | null
  bodyCode: string | null
} = {
  httpStatus: null,
  mercadoPagoMessage: null,
  bodyCode: null
}

if (sanitizedAccessToken) {
  const { response, body } =
    await requestJson(authUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sanitizedAccessToken}`,
        'Content-Type': 'application/json'
      }
    })

  authResponse = {
    httpStatus: response.status,
    mercadoPagoMessage: bodyMessage(body),
    bodyCode:
      body && typeof body === 'object'
        ? safeString((body as Record<string, unknown>).code)
        : null
  }
}

const pixResult = {
  attempted: false,
  environment,
  amount: 1,
  externalReference: null as string | null,
  requestSent: false,
  authorizationHeaderPresent: authorizationAudit.authorizationHeaderPresent,
  httpStatus: null as number | null,
  providerResponseStatus: null as string | null,
  providerPaymentId: null as string | null,
  qrCodePresent: false,
  qrCodeBase64Present: false,
  providerMessage: null as string | null
}

if (shouldCreatePix && authResponse.httpStatus === 200) {
  pixResult.attempted = true
  pixResult.externalReference = `credential-audit-${randomUUID()}`

  const body = {
    transaction_amount: pixResult.amount,
    description: 'Auditoria credencial Mercado Pago',
    payment_method_id: 'pix',
    external_reference: pixResult.externalReference,
    notification_url: mercadoPagoConfig.webhookUrl.trim() || undefined,
    payer: {
      email: `credential-audit-${Date.now()}@example.com`,
      first_name: 'Auditoria'
    },
    metadata: {
      organizationId,
      source: 'credential-audit'
    }
  }

  pixResult.requestSent = true

  const { response, body: responseBody } =
    await requestJson('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sanitizedAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': pixResult.externalReference
      },
      body: JSON.stringify(body)
    })

  const data =
    responseBody && typeof responseBody === 'object'
      ? responseBody as Record<string, any>
      : {}

  pixResult.httpStatus = response.status
  pixResult.providerResponseStatus = safeString(data.status)
  pixResult.providerPaymentId = safeString(data.id)
  pixResult.qrCodePresent =
    Boolean(data.point_of_interaction?.transaction_data?.qr_code)
  pixResult.qrCodeBase64Present =
    Boolean(data.point_of_interaction?.transaction_data?.qr_code_base64)
  pixResult.providerMessage = bodyMessage(responseBody)
}

console.log(JSON.stringify({
  bancoAmbiente: {
    organizationId,
    credentialId: credential?.id ?? null,
    credentialEnvironment: credential?.environment ?? null,
    backendEnvironment: process.env.NODE_ENV ?? null,
    mercadoPagoEndpoint: authUrl,
    environmentMatch:
      credential?.environment === environment
  },
  persistencia: {
    credentialExists: Boolean(credential),
    credentialActive: credential?.active ?? null,
    encryptedCredentialsExists:
      Boolean(credential?.encryptedCredentials),
    decryptionSucceeded,
    decryptionError,
    accessTokenFound: Boolean(sanitizedAccessToken),
    accessTokenLength: sanitizedAccessToken.length,
    accessTokenMasked: maskSecret(sanitizedAccessToken),
    accessTokenPrefix: sanitizedAccessToken.slice(0, 8) || null,
    accessTokenSuffix: sanitizedAccessToken.slice(-4) || null,
    publicKeyFound: Boolean(publicKeyInspection.sanitized),
    publicKeyLength: publicKeyInspection.sanitized.length,
    publicKeyMasked: maskSecret(publicKeyInspection.sanitized),
    publicKeyPrefix: publicKeyInspection.sanitized.slice(0, 8) || null,
    publicKeySuffix: publicKeyInspection.sanitized.slice(-4) || null
  },
  sanitizacao: {
    accessToken: {
      originalLength: accessTokenInspection.originalLength,
      trimmedLength: accessTokenInspection.trimmedLength,
      containsWhitespace: accessTokenInspection.containsWhitespace,
      containsLineBreak: accessTokenInspection.containsLineBreak,
      containsQuotes: accessTokenInspection.containsQuotes,
      containsVariableName: accessTokenInspection.containsVariableName,
      looksLikePlaceholder: accessTokenInspection.looksLikePlaceholder
    },
    publicKey: {
      originalLength: publicKeyInspection.originalLength,
      trimmedLength: publicKeyInspection.trimmedLength,
      containsWhitespace: publicKeyInspection.containsWhitespace,
      containsLineBreak: publicKeyInspection.containsLineBreak,
      containsQuotes: publicKeyInspection.containsQuotes,
      containsVariableName: publicKeyInspection.containsVariableName,
      looksLikePlaceholder: publicKeyInspection.looksLikePlaceholder
    }
  },
  heuristica: {
    rule: '/^(APP_USR|TEST)-/.test(value.trim())',
    accessTokenLooksValid: accessTokenInspection.accessTokenLooksValid,
    publicKeyLooksValid: publicKeyInspection.accessTokenLooksValid,
    note: 'Heuristica de prefixo apenas; conclusao depende do header enviado e da resposta HTTP real.'
  },
  request: {
    ...authorizationAudit,
    contentType: 'application/json',
    idempotencyKeyPresent: false,
    endpoint: authUrl,
    environment
  },
  response: {
    httpStatus: authResponse.httpStatus,
    providerMessage: authResponse.mercadoPagoMessage,
    bodyCode: authResponse.bodyCode
  },
  pixControlado: pixResult
}, null, 2))

await prisma.$disconnect()
