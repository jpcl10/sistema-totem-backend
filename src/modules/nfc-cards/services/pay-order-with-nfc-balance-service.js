import { prisma } from '../../../lib/prisma.js';
import { io } from '../../../lib/socket.js';
import { NfcCardStatus, NfcCardTransactionType, PaymentMethod, PaymentProvider, PaymentStatus, PaymentTransactionStatus, AuditAction, OrderStatus } from '@prisma/client';
import { CreatePrintJobsForOrderService } from '../../print-jobs/services/create-print-jobs-for-order-service.js';
import { CreateAuditLogService } from '../../audit-logs/services/create-audit-log-service.js';
import { mapEventOrderToUnifiedOrder } from '../../orders/presenters/unified-order-presenter.js';
import { resolveCanonicalPublicEvent, resolveLegacyPublicEventSlug } from '../../events/services/public-event-resolver.js';
export class PayOrderWithNfcBalanceService {
    async execute({ eventSlug, organizationSlug, orderId, nfcCardId, uid }) {
        const resolvedEvent = organizationSlug
            ? await resolveCanonicalPublicEvent({
                organizationSlug,
                eventSlug
            })
            : await resolveLegacyPublicEventSlug(eventSlug);
        const event = await prisma.event.findFirst({
            where: {
                id: resolvedEvent.id,
                organizationId: resolvedEvent.organizationId,
                active: true
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        // Find order
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                eventId: event.id
            }
        });
        if (!order) {
            throw new Error('Order not found');
        }
        // Check if order is already paid
        if (order.paymentStatus === PaymentStatus.PAID) {
            throw new Error('Order is already paid');
        }
        // Check if order has valid total
        if (order.totalInCents <= 0) {
            throw new Error('Order total must be greater than zero');
        }
        // Find NFC card
        const nfcCard = await prisma.nfcCard.findFirst({
            where: {
                organizationId: event.organizationId,
                eventId: event.id,
                OR: [
                    ...(nfcCardId ? [{ id: nfcCardId }] : []),
                    ...(uid ? [{ uid: uid.trim().toUpperCase() }] : [])
                ]
            }
        });
        if (!nfcCard) {
            throw new Error('NFC card not found');
        }
        // Check if card is active
        if (nfcCard.status !== NfcCardStatus.ACTIVE) {
            throw new Error('NFC card is not active');
        }
        // Check if balance is sufficient
        if (nfcCard.balanceInCents < order.totalInCents) {
            throw new Error('Insufficient balance');
        }
        const result = await prisma.$transaction(async (tx) => {
            // Update NFC card balance
            const updatedCard = await tx.nfcCard.update({
                where: { id: nfcCard.id },
                data: {
                    balanceInCents: {
                        decrement: order.totalInCents
                    }
                }
            });
            // Create NFC card transaction
            const nfcTransaction = await tx.nfcCardTransaction.create({
                data: {
                    organizationId: event.organizationId,
                    eventId: event.id,
                    nfcCardId: nfcCard.id,
                    userId: null,
                    type: NfcCardTransactionType.PURCHASE,
                    amountInCents: order.totalInCents,
                    balanceBeforeInCents: nfcCard.balanceInCents,
                    balanceAfterInCents: updatedCard.balanceInCents,
                    description: `Pagamento do pedido #${order.orderNumber}`,
                    metadata: {
                        orderId: order.id,
                        orderNumber: order.orderNumber
                    }
                }
            });
            // Update order
            const now = new Date();
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    paymentStatus: PaymentStatus.PAID,
                    status: OrderStatus.CONFIRMED,
                    paymentMethod: PaymentMethod.NFC_BALANCE,
                    amountPaidInCents: order.totalInCents,
                    paidAt: now
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
            // Create payment transaction
            const existingApprovedTransaction = await tx.paymentTransaction.count({
                where: {
                    orderId: order.id,
                    status: PaymentTransactionStatus.APPROVED
                }
            });
            let paymentTransaction;
            if (existingApprovedTransaction === 0) {
                paymentTransaction = await tx.paymentTransaction.create({
                    data: {
                        organizationId: event.organizationId,
                        orderId: order.id,
                        contextType: 'EVENT',
                        eventId: event.id,
                        provider: PaymentProvider.MANUAL,
                        status: PaymentTransactionStatus.APPROVED,
                        method: PaymentMethod.NFC_BALANCE,
                        amountInCents: order.totalInCents,
                        gatewayStatus: 'approved',
                        gatewayMessage: 'Pagamento com saldo NFC aprovado',
                        approvedAt: now,
                        metadata: {
                            nfcCardId: nfcCard.id,
                            nfcCardUid: nfcCard.uid
                        }
                    }
                });
            }
            else {
                paymentTransaction = await tx.paymentTransaction.findFirst({
                    where: {
                        orderId: order.id,
                        status: PaymentTransactionStatus.APPROVED
                    }
                });
            }
            return {
                order: updatedOrder,
                nfcCard: updatedCard,
                nfcTransaction,
                paymentTransaction
            };
        });
        // Create print jobs if needed
        const createPrintJobsForOrderService = new CreatePrintJobsForOrderService();
        await createPrintJobsForOrderService.execute({
            orderId: result.order.id
        });
        // Create audit log
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId: event.organizationId,
            eventId: event.id,
            entity: 'NfcCard',
            entityId: result.nfcCard.id,
            action: AuditAction.NFC_BALANCE_DEBIT,
            description: `Pagamento do pedido #${result.order.orderNumber}`,
            metadata: {
                nfcCardId: result.nfcCard.id,
                orderId: result.order.id,
                orderNumber: result.order.orderNumber,
                amountInCents: order.totalInCents,
                balanceBeforeInCents: result.nfcTransaction.balanceBeforeInCents,
                balanceAfterInCents: result.nfcTransaction.balanceAfterInCents
            }
        });
        // Emit Socket.IO events
        io.to(`event:${event.id}`).emit('order-updated', {
            order: result.order
        });
        io.to(`event:${event.id}`).emit('payment-transaction-updated', {
            paymentTransaction: result.paymentTransaction
        });
        io.to(`event:${event.id}`).emit('nfc-card-updated', {
            nfcCard: result.nfcCard
        });
        const unifiedOrder = await prisma.order.findUnique({
            where: {
                id: result.order.id
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
            io.to(`event:${event.id}`).emit('unified-order-updated', unifiedPayload);
            io.to(`organization:${event.organizationId}`).emit('unified-order-updated', unifiedPayload);
        }
        return {
            order: result.order,
            nfcCard: result.nfcCard,
            transaction: result.nfcTransaction
        };
    }
}
