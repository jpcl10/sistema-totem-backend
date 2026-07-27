import {
  PaymentEnvironment,
  PaymentMethod,
  PaymentProvider,
  PaymentTransactionStatus
} from '@prisma/client'

import { prisma } from '../../../lib/prisma.js'
import { logger } from '../../../lib/logger.js'
import { mercadoPagoConfig } from '../../../shared/config/mercado-pago.js'
import {
  CreatePaymentProviderRequest,
  CreatePaymentProviderResponse,
  PaymentProviderAdapter
} from './payment-provider.js'
import { decryptPaymentCredentials } from '../../payment-settings/payment-credentials-crypto.js'

interface MercadoPagoErrorDetails {
  message: string
  statusCode: string | null
  error: string | null
  cause: string | null
  raw: string | null
}

interface MercadoPagoCredentials {
  accessToken?: string
  publicKey?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toSafeString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return undefined
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date(value).toISOString()
}

function getMercadoPagoErrorDetails(
  error: unknown
): MercadoPagoErrorDetails {
  const fallbackMessage =
    'Erro desconhecido ao criar pagamento no Mercado Pago'

  if (!isRecord(error)) {
    return {
      message:
        error instanceof Error
          ? error.message
          : fallbackMessage,
      statusCode: null,
      error: null,
      cause: null,
      raw: toSafeString(error)
    }
  }

  const response =
    isRecord(error.response)
      ? error.response
      : null

  const responseData =
    response && isRecord(response.data)
      ? response.data
      : null

  const message =
    toSafeString(responseData?.message) ??
    toSafeString(error.message) ??
    (error instanceof Error ? error.message : null) ??
    fallbackMessage

  return {
    message,
    statusCode:
      toSafeString(response?.status) ??
      toSafeString(error.status) ??
      toSafeString(error.statusCode),

    error:
      toSafeString(responseData?.error) ??
      toSafeString(error.error),

    cause:
      toSafeString(responseData?.cause) ??
      toSafeString(error.cause),

    raw:
      toSafeString(responseData) ??
      toSafeString(error)
  }
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack ?? null : null
}

function getMercadoPagoResponseData(value: unknown) {
  if (!isRecord(value)) return value

  return {
    id: value.id ?? null,
    status: value.status ?? null,
    status_detail: value.status_detail ?? null,
    message: value.message ?? null,
    error: value.error ?? null,
    cause: value.cause ?? null,
    point_of_interaction: value.point_of_interaction ?? null
  }
}

function getCredentialSource(
  hasCredentialToken: boolean,
  hasLegacyToken: boolean,
  hasEnvToken: boolean
) {
  if (hasCredentialToken) return 'credential'
  if (hasLegacyToken) return 'legacy_settings'
  if (hasEnvToken) return 'environment'
  return 'missing'
}

function getMetadataRecord(value: unknown) {
  return isRecord(value) ? value : null
}

function looksLikeMercadoPagoAccessToken(value: string) {
  return /^(APP_USR|TEST)-/.test(value)
}

function looksLikeMercadoPagoPublicKey(value: string) {
  return /^(APP_USR|TEST)-/.test(value)
}

function auditAuthorizationHeader(value: string | undefined) {
  const [scheme, tokenValue] =
    typeof value === 'string'
      ? value.split(/\s+/, 2)
      : []

  return {
    authorizationHeaderPresent: Boolean(value),
    authorizationScheme: scheme ?? null,
    authorizationValueLength: tokenValue?.length ?? 0
  }
}

export class MercadoPagoProvider implements PaymentProviderAdapter {
  async createPayment(
    data: CreatePaymentProviderRequest
  ): Promise<CreatePaymentProviderResponse> {
    const metadata =
      getMetadataRecord(data.metadata)

    const onlineOrderId =
      metadata?.onlineOrderId ?? null

    logger.info(
      {
        orderId: data.orderId,
        onlineOrderId,
        organizationId: data.organizationId,
        provider: PaymentProvider.MERCADO_PAGO,
        paymentMethod: data.method,
        amountInCents: data.amountInCents
      },
      'Mercado Pago provider called'
    )

    const externalReference =
      `mp-${data.orderId}-${Date.now()}`

    const settings =
      await prisma.paymentProviderSettings.findUnique({
        where: {
          organizationId_provider: {
            organizationId: data.organizationId,
            provider: PaymentProvider.MERCADO_PAGO
          }
        }
      })

    const organizationPaymentSettings =
      await prisma.organizationPaymentSettings.findUnique({
        where: {
          organizationId: data.organizationId
        },
        select: {
          environment: true,
          pixEnabled: true
        }
      })

    const credential =
      await prisma.paymentProviderCredential.findFirst({
        where: {
          organizationId: data.organizationId,
          provider: PaymentProvider.MERCADO_PAGO,
          environment:
            organizationPaymentSettings?.environment ?? 'PRODUCTION',
          active: true
        }
      })

    let decryptedCredential: MercadoPagoCredentials | null = null
    let credentialDecryptError: unknown = null

    if (credential?.encryptedCredentials) {
      try {
        decryptedCredential =
          decryptPaymentCredentials<MercadoPagoCredentials>(
            credential.encryptedCredentials
          )
      } catch (error) {
        credentialDecryptError = error
      }
    }

    const credentialAccessToken =
      decryptedCredential?.accessToken?.trim() ?? ''

    const credentialPublicKey =
      decryptedCredential?.publicKey?.trim() ?? ''

    const legacyAccessToken =
      settings?.accessToken?.trim() ?? ''

    const envAccessToken =
      mercadoPagoConfig.accessToken.trim()

    const accessToken =
      credentialAccessToken ||
      legacyAccessToken ||
      envAccessToken

    const environment =
      organizationPaymentSettings?.environment ??
      PaymentEnvironment.PRODUCTION

    const hasCredentialToken =
      Boolean(credentialAccessToken)

    const hasLegacyToken =
      Boolean(legacyAccessToken)

    const hasEnvToken =
      Boolean(envAccessToken)

    const publicKey =
      credentialPublicKey ||
      settings?.publicKey?.trim() ||
      mercadoPagoConfig.publicKey.trim()

    const isProviderEnabled =
      settings?.enabled ?? credential?.active ?? false

    const isPixEnabled =
      settings?.pixEnabled ?? organizationPaymentSettings?.pixEnabled ?? false

    logger.info(
      {
        orderId: data.orderId,
        onlineOrderId,
        paymentTransactionId: null,
        organizationId: data.organizationId,
        provider: PaymentProvider.MERCADO_PAGO,
        paymentMethod: data.method,
        environment,
        credentialFound: Boolean(credential),
        credentialActive: credential?.active ?? null,
        credentialEnvironment: credential?.environment ?? null,
        credentialReadable: !credentialDecryptError,
        credentialHasEncryptedPayload:
          Boolean(credential?.encryptedCredentials),
        accessTokenFound: Boolean(accessToken),
        accessTokenLooksValid:
          accessToken
            ? looksLikeMercadoPagoAccessToken(accessToken)
            : false,
        accessTokenSource: getCredentialSource(
          hasCredentialToken,
          hasLegacyToken,
          hasEnvToken
        ),
        publicKeyFound: Boolean(publicKey),
        publicKeyLooksValid:
          publicKey
            ? looksLikeMercadoPagoPublicKey(publicKey)
            : false,
        providerEnabled: isProviderEnabled,
        pixEnabled: isPixEnabled,
        externalReference,
        amountInCents: data.amountInCents,
        payer: {
          hasEmail: Boolean(data.payerEmail?.trim()),
          hasName: Boolean(data.payerName?.trim())
        },
        notificationUrl:
          mercadoPagoConfig.webhookUrl.trim() || null,
        expiration: toIsoDate(data.expiresAt)
      },
      'Mercado Pago credential and request context'
    )

    if (credentialDecryptError) {
      logger.error(
        {
          orderId: data.orderId,
          onlineOrderId,
          organizationId: data.organizationId,
          provider: PaymentProvider.MERCADO_PAGO,
          paymentMethod: data.method,
          environment,
          error:
            credentialDecryptError instanceof Error
              ? credentialDecryptError.message
              : toSafeString(credentialDecryptError),
          stack: getErrorStack(credentialDecryptError)
        },
        'Mercado Pago credential decrypt failed'
      )
    }

    if (!accessToken) {
      return {
        provider: PaymentProvider.MERCADO_PAGO,
        status: PaymentTransactionStatus.CREATED,
        method: data.method,
        amountInCents: data.amountInCents,
        externalId: null,
        externalReference,
        qrCode: null,
        qrCodeBase64: null,
        pixCopyPaste: null,
        gatewayStatus: 'missing_access_token',
        gatewayMessage: 'Mercado Pago access token não configurado',
        metadata: {
          source: 'mercado-pago-provider',
          organizationId: data.organizationId,
          orderId: data.orderId
        }
      }
    }

    if (!isProviderEnabled) {
      return {
        provider: PaymentProvider.MERCADO_PAGO,
        status: PaymentTransactionStatus.CREATED,
        method: data.method,
        amountInCents: data.amountInCents,
        externalId: null,
        externalReference,
        qrCode: null,
        qrCodeBase64: null,
        pixCopyPaste: null,
        gatewayStatus: 'provider_disabled',
        gatewayMessage: 'Mercado Pago está desativado para esta organização',
        metadata: {
          source: 'mercado-pago-provider',
          organizationId: data.organizationId,
          orderId: data.orderId
        }
      }
    }

    if (data.method !== PaymentMethod.PIX_AUTOMATIC) {
      return {
        provider: PaymentProvider.MERCADO_PAGO,
        status: PaymentTransactionStatus.CREATED,
        method: data.method,
        amountInCents: data.amountInCents,
        externalId: null,
        externalReference,
        qrCode: null,
        qrCodeBase64: null,
        pixCopyPaste: null,
        gatewayStatus: 'method_not_implemented',
        gatewayMessage:
          'Este método ainda não foi implementado no Mercado Pago provider',
        metadata: {
          source: 'mercado-pago-provider',
          organizationId: data.organizationId,
          orderId: data.orderId,
          method: data.method
        }
      }
    }

    if (!isPixEnabled) {
      return {
        provider: PaymentProvider.MERCADO_PAGO,
        status: PaymentTransactionStatus.CREATED,
        method: data.method,
        amountInCents: data.amountInCents,
        externalId: null,
        externalReference,
        qrCode: null,
        qrCodeBase64: null,
        pixCopyPaste: null,
        gatewayStatus: 'pix_disabled',
        gatewayMessage: 'PIX Mercado Pago está desativado para esta organização',
        metadata: {
          source: 'mercado-pago-provider',
          organizationId: data.organizationId,
          orderId: data.orderId
        }
      }
    }

    try {
      const dateOfExpiration =
        toIsoDate(data.expiresAt)

      const requestBody = {
        transaction_amount:
          data.amountInCents / 100,

        description:
          data.description ?? `Pedido ${data.orderId}`,

        payment_method_id: 'pix',

        external_reference:
          externalReference,

        date_of_expiration:
          dateOfExpiration,

        notification_url:
          mercadoPagoConfig.webhookUrl.trim() || undefined,

        payer: {
          email:
            data.payerEmail?.trim() ??
            'cliente@email.com',

          first_name:
            data.payerName ?? 'Cliente'
        },

        metadata: {
          organizationId: data.organizationId,
          orderId: data.orderId,
          ...(metadata ?? {})
        }
      }

      logger.info(
        {
          orderId: data.orderId,
          onlineOrderId,
          paymentTransactionId: null,
          organizationId: data.organizationId,
          provider: PaymentProvider.MERCADO_PAGO,
          paymentMethod: data.method,
          environment,
          url: 'https://api.mercadopago.com/v1/payments',
          method: 'POST',
          idempotencyKey: externalReference,
          requestBody
        },
        'Mercado Pago PIX create payment request'
      )

      const authorizationHeader =
        `Bearer ${accessToken}`

      const headers = {
        Authorization: authorizationHeader,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': externalReference
      }

      logger.info(
        {
          orderId: data.orderId,
          onlineOrderId,
          paymentTransactionId: null,
          organizationId: data.organizationId,
          provider: PaymentProvider.MERCADO_PAGO,
          paymentMethod: data.method,
          environment,
          method: 'POST',
          url: 'https://api.mercadopago.com/v1/payments',
          ...auditAuthorizationHeader(headers.Authorization),
          contentType: headers['Content-Type'],
          idempotencyKeyPresent: Boolean(headers['X-Idempotency-Key']),
          bodyKeys: Object.keys(requestBody)
        },
        'Mercado Pago PIX final HTTP request audit'
      )

      const response =
        await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        })

      const responseText =
        await response.text()

      let result: unknown = responseText

      try {
        result = JSON.parse(responseText)
      } catch {
        result = responseText
      }

      logger.info(
        {
          orderId: data.orderId,
          onlineOrderId,
          paymentTransactionId: null,
          organizationId: data.organizationId,
          provider: PaymentProvider.MERCADO_PAGO,
          paymentMethod: data.method,
          environment,
          httpStatus: response.status,
          responseOk: response.ok,
          responseBody: getMercadoPagoResponseData(result)
        },
        'Mercado Pago PIX create payment response'
      )

      if (!response.ok) {
        const apiMessage =
          isRecord(result)
            ? toSafeString(result.message) ??
              toSafeString(result.error) ??
              response.statusText
            : responseText || response.statusText

        throw Object.assign(
          new Error(apiMessage),
          {
            response: {
              status: response.status,
              data: result
            }
          }
        )
      }

      const mercadoPagoPayment =
        result as any

      const transactionData =
        mercadoPagoPayment.point_of_interaction
          ?.transaction_data

      return {
        provider: PaymentProvider.MERCADO_PAGO,
        status: PaymentTransactionStatus.WAITING_PAYMENT,
        method: data.method,
        amountInCents: data.amountInCents,

        externalId:
          mercadoPagoPayment.id?.toString() ?? null,

        externalReference,

        qrCode:
          transactionData?.qr_code ?? null,

        qrCodeBase64:
          transactionData?.qr_code_base64 ?? null,

        pixCopyPaste:
          transactionData?.qr_code ?? null,

        gatewayStatus:
          mercadoPagoPayment.status ?? null,

        gatewayMessage:
          mercadoPagoPayment.status_detail ??
          'PIX Mercado Pago criado',

        metadata: {
          source: 'mercado-pago-provider',
          organizationId: data.organizationId,
          orderId: data.orderId,
          mercadoPagoPaymentId:
            mercadoPagoPayment.id ?? null,
          ticketUrl:
            transactionData?.ticket_url ?? null,
          expiresAt:
            dateOfExpiration ?? null
        }
      }
    } catch (error) {
      const errorDetails =
        getMercadoPagoErrorDetails(error)

      logger.error(
        {
          orderId: data.orderId,
          onlineOrderId,
          paymentTransactionId: null,
          organizationId: data.organizationId,
          provider: PaymentProvider.MERCADO_PAGO,
          paymentMethod: data.method,
          environment,
          error: errorDetails,
          exception:
            error instanceof Error ? error.message : toSafeString(error),
          stack: getErrorStack(error)
        },
        'Mercado Pago PIX create payment exception'
      )

      return {
        provider: PaymentProvider.MERCADO_PAGO,
        status: PaymentTransactionStatus.ERROR,
        method: data.method,
        amountInCents: data.amountInCents,
        externalId: null,
        externalReference,
        qrCode: null,
        qrCodeBase64: null,
        pixCopyPaste: null,
        gatewayStatus: 'mercado_pago_error',
        gatewayMessage: errorDetails.message,
        metadata: {
          source: 'mercado-pago-provider-error',
          organizationId: data.organizationId,
          orderId: data.orderId,
          mercadoPagoError: {
            message: errorDetails.message,
            statusCode: errorDetails.statusCode,
            error: errorDetails.error,
            cause: errorDetails.cause,
            raw: errorDetails.raw
          }
        }
      }
    }
  }
}
