import { OrderStatus, PaymentMethod, PaymentStatus, PrintJobStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
export class GetEventClosingPreviewService {
    async execute({ eventId, organizationId }) {
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                organizationId
            },
            select: {
                id: true,
                name: true,
                slug: true,
                active: true,
                closing: {
                    select: {
                        id: true,
                        closedAt: true
                    }
                }
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const orders = await prisma.order.findMany({
            where: {
                eventId
            },
            select: {
                id: true,
                status: true,
                paymentStatus: true,
                paymentMethod: true,
                totalInCents: true,
                amountPaidInCents: true,
                createdAt: true
            }
        });
        const printJobs = await prisma.eventPrintJob.findMany({
            where: {
                eventId
            },
            select: {
                id: true,
                status: true
            }
        });
        const totalOrders = orders.length;
        const paidOrders = orders.filter(order => order.paymentStatus === PaymentStatus.PAID);
        const pendingOrders = orders.filter(order => order.paymentStatus === PaymentStatus.PENDING);
        const cancelledOrders = orders.filter(order => order.status === OrderStatus.CANCELLED ||
            order.paymentStatus === PaymentStatus.CANCELLED);
        const receivedInCents = paidOrders.reduce((total, order) => {
            return total + (order.amountPaidInCents ?? order.totalInCents);
        }, 0);
        const pendingInCents = pendingOrders.reduce((total, order) => {
            return total + order.totalInCents;
        }, 0);
        const cancelledInCents = cancelledOrders.reduce((total, order) => {
            return total + order.totalInCents;
        }, 0);
        const averageTicketInCents = paidOrders.length > 0
            ? Math.round(receivedInCents / paidOrders.length)
            : 0;
        const byPaymentMethod = {
            PIX_MANUAL: 0,
            PIX_AUTOMATIC: 0,
            CASH: 0,
            CREDIT_CARD: 0,
            DEBIT_CARD: 0,
            COURTESY: 0,
            OTHER: 0
        };
        for (const order of paidOrders) {
            const amount = order.amountPaidInCents ?? order.totalInCents;
            switch (order.paymentMethod) {
                case PaymentMethod.PIX_MANUAL:
                    byPaymentMethod.PIX_MANUAL += amount;
                    break;
                case PaymentMethod.PIX_AUTOMATIC:
                    byPaymentMethod.PIX_AUTOMATIC += amount;
                    break;
                case PaymentMethod.CASH:
                    byPaymentMethod.CASH += amount;
                    break;
                case PaymentMethod.CREDIT_CARD:
                    byPaymentMethod.CREDIT_CARD += amount;
                    break;
                case PaymentMethod.DEBIT_CARD:
                    byPaymentMethod.DEBIT_CARD += amount;
                    break;
                case PaymentMethod.COURTESY:
                    byPaymentMethod.COURTESY += amount;
                    break;
                case PaymentMethod.OTHER:
                default:
                    byPaymentMethod.OTHER += amount;
                    break;
            }
        }
        const printSummary = {
            pending: printJobs.filter(job => job.status === PrintJobStatus.PENDING ||
                job.status === PrintJobStatus.RETRY ||
                job.status === PrintJobStatus.PROCESSING).length,
            printed: printJobs.filter(job => job.status === PrintJobStatus.PRINTED ||
                job.status === PrintJobStatus.COMPLETED).length,
            error: printJobs.filter(job => job.status === PrintJobStatus.ERROR).length,
            cancelled: printJobs.filter(job => job.status === PrintJobStatus.CANCELLED).length
        };
        const warnings = [];
        if (pendingOrders.length > 0) {
            warnings.push({
                type: 'PENDING_ORDERS',
                message: `Existem ${pendingOrders.length} pedidos com pagamento pendente`
            });
        }
        if (printSummary.error > 0) {
            warnings.push({
                type: 'PRINT_ERRORS',
                message: `Existem ${printSummary.error} impressões com erro`
            });
        }
        if (event.closing) {
            warnings.push({
                type: 'EVENT_ALREADY_CLOSED',
                message: 'Este evento já foi fechado'
            });
        }
        return {
            event: {
                id: event.id,
                name: event.name,
                slug: event.slug,
                active: event.active,
                closed: Boolean(event.closing),
                closedAt: event.closing?.closedAt ?? null
            },
            summary: {
                totalOrders,
                paidOrders: paidOrders.length,
                pendingOrders: pendingOrders.length,
                cancelledOrders: cancelledOrders.length,
                receivedInCents,
                pendingInCents,
                cancelledInCents,
                averageTicketInCents
            },
            byPaymentMethod,
            printSummary,
            warnings
        };
    }
}
