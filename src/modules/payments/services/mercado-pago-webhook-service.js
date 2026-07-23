import { AuditAction, PaymentProvider, PaymentStatus, PaymentTransactionStatus, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma } from '../../../lib/prisma.js';
import { io } from '../../../lib/socket.js';
import { logger } from '../../../lib/logger.js';
import { mercadoPagoConfig } from '../../../shared/config/mercado-pago.js';
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { mapEventOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js';
import { decryptPaymentCredentials } from '../../payment-settings/payment-credentials-crypto.js';
function toJsonValue(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}
function validateMercadoPagoSignature(headers, paymentId, webhookSecret) {
    if (!webhookSecret) {
        logger.error('Missing MERCADO_PAGO_WEBHOOK_SECRET');
        return { valid: false, reason: 'webhook_secret_not_configured' };
    }
    const xSignature = headers['x-signature'];
    const xRequestId = headers['x-request-id'];
    if (!xSignature) {
        logger.error('Missing x-signature header');
        return { valid: false, reason: 'missing_x_signature' };
    }
    if (!xRequestId) {
        logger.warn('Missing x-request-id header - proceeding without idempotency check');
    }
    const parts = xSignature.split(',');
    let ts = null;
    let v1 = null;
    for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 'ts')
            ts = value;
        if (key === 'v1')
            v1 = value;
    }
    if (!ts) {
        logger.error('Missing ts in x-signature');
        return { valid: false, reason: 'missing_ts' };
    }
    if (!v1) {
        logger.error('Missing v1 in x-signature');
        return { valid: false, reason: 'missing_v1' };
    }
    const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(manifest);
    const expectedSignature = hmac.digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(v1, 'hex');
    if (expectedBuffer.length !== receivedBuffer.length) {
        logger.error('Invalid signature length');
        return { valid: false, reason: 'invalid_signature' };
    }
    const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!isValid) {
        logger.error('Invalid signature');
        return { valid: false, reason: 'invalid_signature' };
    }
    return { valid: true, xRequestId };
}
async function createWebhookEvent(data) {
    try {
        return await prisma.paymentWebhookEvent.create({
            data: {
                organizationId: data.organizationId ?? null,
                provider: PaymentProvider.MERCADO_PAGO,
                externalPaymentId: data.paymentId,
                idempotencyKey: data.idempotencyKey ?? null,
                payload: toJsonValue(data.body),
                headers: toJsonValue(data.headers),
                processed: data.processed ?? false,
                ignored: data.ignored ?? false,
                reason: data.reason ?? null,
                processedAt: data.processed || data.ignored
                    ? new Date()
                    : null
            }
        });
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            return null;
        }
        throw error;
    }
}
function getNestedValue(value, path) {
    let current = value;
    for (const key of path) {
        if (!current || typeof current !== 'object') {
            return null;
        }
        current = current[key];
    }
    return current ?? null;
}
function getPaymentIdFromWebhook(body, query) {
    const bodyDataId = getNestedValue(body, ['data', 'id']);
    const bodyId = getNestedValue(body, ['id']);
    const queryDataId = getNestedValue(query, ['data.id']);
    const queryId = getNestedValue(query, ['id']);
    const possibleId = bodyDataId ?? bodyId ?? queryDataId ?? queryId;
    if (possibleId === null ||
        possibleId === undefined) {
        return null;
    }
    return String(possibleId);
}
function mapMercadoPagoStatusToTransactionStatus(status) {
    switch (status) {
        case 'approved':
            return PaymentTransactionStatus.APPROVED;
        case 'rejected':
            return PaymentTransactionStatus.REJECTED;
        case 'cancelled':
            return PaymentTransactionStatus.CANCELLED;
        case 'refunded':
            return PaymentTransactionStatus.REFUNDED;
        case 'expired':
            return PaymentTransactionStatus.EXPIRED;
        case 'pending':
        case 'in_process':
        default:
            return PaymentTransactionStatus.WAITING_PAYMENT;
    }
}
export class MercadoPagoWebhookService {
    async execute({ body, query, headers }) {
        const paymentId = getPaymentIdFromWebhook(body, query);
        if (!paymentId) {
            return {
                received: true,
                ignored: true,
                reason: 'payment_id_not_found'
            };
        }
        const paymentTransaction = await prisma.paymentTransaction.findFirst({
            where: {
                provider: PaymentProvider.MERCADO_PAGO,
                externalId: paymentId
            },
            include: {
                order: {
                    include: {
                        event: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                organizationId: true
                            }
                        },
                        items: true
                    }
                }
            }
        });
        if (!paymentTransaction) {
            await createWebhookEvent({
                paymentId,
                body,
                headers,
                ignored: true,
                reason: 'payment_transaction_not_found'
            });
            return {
                received: true,
                ignored: true,
                reason: 'payment_transaction_not_found',
                paymentId
            };
        }
        if (!paymentTransaction.order || !paymentTransaction.orderId) {
            await createWebhookEvent({
                organizationId: paymentTransaction.organizationId,
                paymentId,
                body,
                headers,
                ignored: true,
                reason: 'payment_transaction_without_event_order'
            });
            return {
                received: true,
                ignored: true,
                reason: 'payment_transaction_without_event_order',
                paymentId
            };
        }
        const eventOrder = paymentTransaction.order;
        const orderId = paymentTransaction.orderId;
        const eventId = eventOrder.eventId;
        const organizationId = paymentTransaction.organizationId;
        if (organizationId !== eventOrder.event.organizationId) {
            await createWebhookEvent({
                organizationId,
                paymentId,
                body,
                headers,
                ignored: true,
                reason: 'organization_mismatch'
            });
            return {
                received: true,
                ignored: true,
                reason: 'organization_mismatch',
                paymentId
            };
        }
        const mercadoPagoSettings = await prisma.paymentProviderSettings.findUnique({
            where: {
                organizationId_provider: {
                    organizationId,
                    provider: PaymentProvider.MERCADO_PAGO
                }
            }
        });
        const organizationPaymentSettings = await prisma.organizationPaymentSettings.findUnique({
            where: {
                organizationId
            },
            select: {
                environment: true
            }
        });
        const credential = await prisma.paymentProviderCredential.findFirst({
            where: {
                organizationId,
                provider: PaymentProvider.MERCADO_PAGO,
                environment: organizationPaymentSettings?.environment ?? 'PRODUCTION',
                active: true
            }
        });
        const decryptedCredentials = credential?.encryptedCredentials
            ? decryptPaymentCredentials(credential.encryptedCredentials)
            : null;
        const webhookSecret = decryptedCredentials?.webhookSecret?.trim() ||
            mercadoPagoSettings?.webhookSecret?.trim() ||
            process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ||
            null;
        const validation = validateMercadoPagoSignature(headers, paymentId, webhookSecret);
        if (!validation.valid) {
            await createWebhookEvent({
                organizationId,
                paymentId,
                body,
                headers,
                ignored: true,
                reason: validation.reason || 'invalid_signature'
            });
            return {
                received: true,
                ignored: true,
                reason: validation.reason || 'invalid_signature',
                paymentId
            };
        }
        const xRequestId = validation.xRequestId;
        const webhookIdempotencyKey = xRequestId ? `mercado-pago:${xRequestId}` : null;
        if (webhookIdempotencyKey) {
            const existingWebhookEvent = await prisma.paymentWebhookEvent.findUnique({
                where: {
                    idempotencyKey: webhookIdempotencyKey
                }
            });
            if (existingWebhookEvent) {
                logger.info({ xRequestId, paymentId }, 'Webhook event already recorded - skipping');
                return {
                    received: true,
                    ignored: true,
                    reason: 'webhook_already_processed',
                    paymentId
                };
            }
        }
        if (xRequestId && paymentTransaction.metadata) {
            const metadata = paymentTransaction.metadata;
            const processedWebhookRequestIds = metadata.processedWebhookRequestIds;
            if (processedWebhookRequestIds &&
                processedWebhookRequestIds.includes(xRequestId)) {
                logger.info({ xRequestId, paymentId }, 'Webhook already processed - skipping');
                await createWebhookEvent({
                    organizationId,
                    paymentId,
                    idempotencyKey: webhookIdempotencyKey,
                    body,
                    headers,
                    ignored: true,
                    reason: 'webhook_already_processed'
                });
                return {
                    received: true,
                    ignored: true,
                    reason: 'webhook_already_processed',
                    paymentId
                };
            }
        }
        const accessToken = decryptedCredentials?.accessToken?.trim() ||
            mercadoPagoSettings?.accessToken?.trim() ||
            mercadoPagoConfig.accessToken.trim();
        if (!accessToken) {
            await createWebhookEvent({
                organizationId,
                paymentId,
                idempotencyKey: webhookIdempotencyKey,
                body,
                headers,
                ignored: true,
                reason: 'mercado_pago_not_configured'
            });
            return {
                received: true,
                ignored: true,
                reason: 'mercado_pago_not_configured',
                paymentId
            };
        }
        const client = new MercadoPagoConfig({
            accessToken
        });
        const paymentClient = new Payment(client);
        const mercadoPagoPayment = await paymentClient.get({
            id: paymentId
        });
        const mercadoPagoStatus = mercadoPagoPayment.status ?? null;
        const transactionStatus = mapMercadoPagoStatusToTransactionStatus(mercadoPagoStatus);
        const now = new Date();
        const updatedOrder = await prisma.$transaction(async (tx) => {
            const existingMetadata = paymentTransaction.metadata || {};
            const existingProcessedIds = Array.isArray(existingMetadata.processedWebhookRequestIds)
                ? existingMetadata.processedWebhookRequestIds
                : [];
            const updatedProcessedIds = xRequestId
                ? [...new Set([...existingProcessedIds, xRequestId])]
                : existingProcessedIds;
            const updatedPaymentTransaction = await tx.paymentTransaction.update({
                where: {
                    id: paymentTransaction.id
                },
                data: {
                    status: transactionStatus,
                    gatewayStatus: mercadoPagoStatus,
                    gatewayMessage: mercadoPagoPayment.status_detail ?? null,
                    approvedAt: transactionStatus === PaymentTransactionStatus.APPROVED
                        ? now
                        : paymentTransaction.approvedAt,
                    rejectedAt: transactionStatus === PaymentTransactionStatus.REJECTED
                        ? now
                        : paymentTransaction.rejectedAt,
                    cancelledAt: transactionStatus === PaymentTransactionStatus.CANCELLED
                        ? now
                        : paymentTransaction.cancelledAt,
                    refundedAt: transactionStatus === PaymentTransactionStatus.REFUNDED
                        ? now
                        : paymentTransaction.refundedAt,
                    expiredAt: transactionStatus === PaymentTransactionStatus.EXPIRED
                        ? now
                        : paymentTransaction.expiredAt,
                    metadata: {
                        ...existingMetadata,
                        source: 'mercado-pago-webhook',
                        mercadoPagoPayment: JSON.parse(JSON.stringify(mercadoPagoPayment)),
                        processedWebhookRequestIds: updatedProcessedIds
                    }
                }
            });
            if (updatedPaymentTransaction.status !==
                PaymentTransactionStatus.APPROVED) {
                return eventOrder;
            }
            const updated = await tx.order.update({
                where: {
                    id: orderId
                },
                data: {
                    paymentStatus: PaymentStatus.PAID,
                    paymentMethod: paymentTransaction.method,
                    amountPaidInCents: updatedPaymentTransaction.amountInCents,
                    paidAt: now,
                    paymentNotes: 'Pagamento aprovado automaticamente pelo Mercado Pago'
                },
                include: {
                    items: true,
                    event: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            organizationId: true
                        }
                    }
                }
            });
            return updated;
        });
        await createWebhookEvent({
            organizationId,
            paymentId,
            idempotencyKey: webhookIdempotencyKey,
            body,
            headers,
            processed: true
        });
        const createAuditLogService = new CreateAuditLogService();
        if (updatedOrder.paymentStatus === PaymentStatus.PAID) {
            await createAuditLogService.execute({
                organizationId,
                eventId,
                entity: 'PaymentTransaction',
                entityId: paymentTransaction.id,
                action: AuditAction.PAYMENT_APPROVED,
                description: 'Pagamento aprovado via PIX',
                metadata: {
                    paymentId: paymentTransaction.id,
                    orderId: updatedOrder.id,
                    amountInCents: paymentTransaction.amountInCents,
                    provider: PaymentProvider.MERCADO_PAGO,
                    gatewayStatus: mercadoPagoStatus
                }
            });
            const createPrintJobsForOrderService = new CreatePrintJobsForOrderService();
            await createPrintJobsForOrderService.execute({
                orderId: updatedOrder.id
            });
        }
        else if (transactionStatus === PaymentTransactionStatus.REJECTED) {
            await createAuditLogService.execute({
                organizationId,
                eventId,
                entity: 'PaymentTransaction',
                entityId: paymentTransaction.id,
                action: AuditAction.PAYMENT_REJECTED,
                description: 'Pagamento rejeitado',
                metadata: {
                    paymentId: paymentTransaction.id,
                    orderId,
                    amountInCents: paymentTransaction.amountInCents,
                    provider: PaymentProvider.MERCADO_PAGO,
                    gatewayStatus: mercadoPagoStatus,
                    gatewayMessage: mercadoPagoPayment.status_detail
                }
            });
        }
        else if (transactionStatus === PaymentTransactionStatus.REFUNDED) {
            await createAuditLogService.execute({
                organizationId,
                eventId,
                entity: 'PaymentTransaction',
                entityId: paymentTransaction.id,
                action: AuditAction.PAYMENT_REFUNDED,
                description: 'Pagamento reembolsado',
                metadata: {
                    paymentId: paymentTransaction.id,
                    orderId,
                    amountInCents: paymentTransaction.amountInCents,
                    provider: PaymentProvider.MERCADO_PAGO,
                    gatewayStatus: mercadoPagoStatus,
                    gatewayMessage: mercadoPagoPayment.status_detail
                }
            });
        }
        io.to(`event:${updatedOrder.eventId}`).emit('order-updated', {
            order: updatedOrder
        });
        const unifiedOrder = await prisma.order.findUnique({
            where: {
                id: updatedOrder.id
            },
            include: {
                event: {
                    select: {
                        id: true,
                        name: true,
                        organizationId: true,
                        printingEnabled: true
                    }
                },
                customer: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                device: {
                    select: {
                        id: true,
                        type: true,
                        name: true
                    }
                },
                items: {
                    include: {
                        options: true
                    }
                },
                printJobs: {
                    select: {
                        id: true,
                        status: true
                    }
                },
                paymentTransactions: {
                    select: {
                        id: true
                    }
                }
            }
        });
        if (unifiedOrder) {
            const unifiedPayload = {
                order: mapEventOrderToUnifiedOrder(unifiedOrder)
            };
            io.to(`event:${updatedOrder.eventId}`).emit('unified-order-updated', unifiedPayload);
            io.to(`organization:${organizationId}`).emit('unified-order-updated', unifiedPayload);
        }
        return {
            received: true,
            paymentId,
            transactionStatus,
            orderId: updatedOrder.id,
            paymentStatus: updatedOrder.paymentStatus
        };
    }
}
