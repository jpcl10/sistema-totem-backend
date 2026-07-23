import { FinancialAggregationService } from './financial-aggregation-service.js';
export class GetEventFinancialSummaryService {
    async execute({ organizationId, userRole, eventId, period = 'EVENT', startDate, endDate }) {
        const { summary } = await new FinancialAggregationService().execute({
            organizationId,
            userRole,
            orderType: 'EVENT_ORDER',
            eventId,
            period,
            startDate,
            endDate
        });
        return {
            summary: {
                ...summary,
                financialPeriod: summary.period,
                period: summary.period.type,
                eventId,
                dateRange: summary.period.startDate
                    ? {
                        startDate: summary.period.startDate,
                        endDate: summary.period.endDate
                    }
                    : null,
                paidOrders: summary.paidOrdersCount,
                pendingOrders: summary.pendingOrdersCount,
                cancelledOrders: summary.canceledOrdersCount,
                refundedOrders: summary.refundedOrdersCount,
                grossTotalInCents: summary.grossRevenueInCents,
                paidTotalInCents: summary.grossRevenueInCents,
                refundedTotalInCents: summary.refundsInCents
            }
        };
    }
}
