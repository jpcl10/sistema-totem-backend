import { PaymentMethod, PaymentProvider, PaymentTransactionStatus } from '@prisma/client';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';
import { mercadoPagoConfig } from '../../../shared/config/mercado-pago.js';
import { decryptPaymentCredentials } from '../../payment-settings/payment-credentials-crypto.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function toSafeString(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') {
        return String(value);
    }
    try {
        return JSON.stringify(value);
    }
    catch {
        return null;
    }
}
function toIsoDate(value) {
    if (!value) {
        return undefined;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return new Date(value).toISOString();
}
function getMercadoPagoErrorDetails(error) {
    const fallbackMessage = 'Erro desconhecido ao criar pagamento no Mercado Pago';
    if (!isRecord(error)) {
        return {
            message: error instanceof Error
                ? error.message
                : fallbackMessage,
            statusCode: null,
            error: null,
            cause: null,
            raw: toSafeString(error)
        };
    }
    const response = isRecord(error.response)
        ? error.response
        : null;
    const responseData = response && isRecord(response.data)
        ? response.data
        : null;
    const message = toSafeString(responseData?.message) ??
        toSafeString(error.message) ??
        (error instanceof Error ? error.message : null) ??
        fallbackMessage;
    return {
        message,
        statusCode: toSafeString(response?.status) ??
            toSafeString(error.status) ??
            toSafeString(error.statusCode),
        error: toSafeString(responseData?.error) ??
            toSafeString(error.error),
        cause: toSafeString(responseData?.cause) ??
            toSafeString(error.cause),
        raw: toSafeString(responseData) ??
            toSafeString(error)
    };
}
export class MercadoPagoProvider {
    async createPayment(data) {
        logger.info({ orderId: data.orderId, organizationId: data.organizationId }, 'Mercado Pago provider called');
        const externalReference = `mp-${data.orderId}-${Date.now()}`;
        const settings = await prisma.paymentProviderSettings.findUnique({
            where: {
                organizationId_provider: {
                    organizationId: data.organizationId,
                    provider: PaymentProvider.MERCADO_PAGO
                }
            }
        });
        const organizationPaymentSettings = await prisma.organizationPaymentSettings.findUnique({
            where: {
                organizationId: data.organizationId
            },
            select: {
                environment: true
            }
        });
        const credential = await prisma.paymentProviderCredential.findFirst({
            where: {
                organizationId: data.organizationId,
                provider: PaymentProvider.MERCADO_PAGO,
                environment: organizationPaymentSettings?.environment ?? 'PRODUCTION',
                active: true
            }
        });
        const credentialAccessToken = credential?.encryptedCredentials
            ? decryptPaymentCredentials(credential.encryptedCredentials).accessToken?.trim()
            : '';
        const accessToken = credentialAccessToken ||
            settings?.accessToken?.trim() ||
            mercadoPagoConfig.accessToken.trim();
        const isProviderEnabled = settings?.enabled ?? false;
        const isPixEnabled = settings?.pixEnabled ?? false;
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
            };
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
            };
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
                gatewayMessage: 'Este método ainda não foi implementado no Mercado Pago provider',
                metadata: {
                    source: 'mercado-pago-provider',
                    organizationId: data.organizationId,
                    orderId: data.orderId,
                    method: data.method
                }
            };
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
            };
        }
        try {
            const client = new MercadoPagoConfig({
                accessToken
            });
            const payment = new Payment(client);
            const dateOfExpiration = toIsoDate(data.expiresAt);
            logger.debug({
                orderId: data.orderId,
                expiresAt: data.expiresAt,
                dateOfExpiration
            }, 'PIX date of expiration set');
            const result = await payment.create({
                body: {
                    transaction_amount: data.amountInCents / 100,
                    description: data.description ?? `Pedido ${data.orderId}`,
                    payment_method_id: 'pix',
                    external_reference: externalReference,
                    date_of_expiration: dateOfExpiration,
                    payer: {
                        email: data.payerEmail ??
                            'cliente@email.com',
                        first_name: data.payerName ?? 'Cliente'
                    },
                    metadata: {
                        organizationId: data.organizationId,
                        orderId: data.orderId
                    }
                },
                requestOptions: {
                    idempotencyKey: externalReference
                }
            });
            const mercadoPagoPayment = result;
            const transactionData = mercadoPagoPayment.point_of_interaction
                ?.transaction_data;
            return {
                provider: PaymentProvider.MERCADO_PAGO,
                status: PaymentTransactionStatus.WAITING_PAYMENT,
                method: data.method,
                amountInCents: data.amountInCents,
                externalId: mercadoPagoPayment.id?.toString() ?? null,
                externalReference,
                qrCode: transactionData?.qr_code ?? null,
                qrCodeBase64: transactionData?.qr_code_base64 ?? null,
                pixCopyPaste: transactionData?.qr_code ?? null,
                gatewayStatus: mercadoPagoPayment.status ?? null,
                gatewayMessage: mercadoPagoPayment.status_detail ??
                    'PIX Mercado Pago criado',
                metadata: {
                    source: 'mercado-pago-provider',
                    organizationId: data.organizationId,
                    orderId: data.orderId,
                    mercadoPagoPaymentId: mercadoPagoPayment.id ?? null,
                    ticketUrl: transactionData?.ticket_url ?? null,
                    expiresAt: dateOfExpiration ?? null
                }
            };
        }
        catch (error) {
            const errorDetails = getMercadoPagoErrorDetails(error);
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
            };
        }
    }
}
