import { OnlineOrderFulfillmentType, PaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
import { FinancialAggregationService } from '../services/financial-aggregation-service.js';
const getFinancialSummaryQuerySchema = z.object({
    period: z
        .enum([
        'EVENT',
        'TODAY',
        'YESTERDAY',
        '24H',
        '7D',
        'LAST_7_DAYS',
        'LAST_30_DAYS',
        'CUSTOM'
    ])
        .default('TODAY'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    storeId: z.string().min(1).optional(),
    eventId: z.string().min(1).optional(),
    source: z
        .enum([
        'EVENT',
        'TOTEM',
        'MANUAL_EVENT',
        'ONLINE_STORE',
        'MANUAL_STORE',
        'DIGITAL_MENU',
        'POS',
        'API',
        'WHATSAPP'
    ])
        .optional(),
    orderType: z
        .enum(['EVENT_ORDER', 'ONLINE_ORDER'])
        .optional(),
    paymentMethod: z.string().trim().min(1).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    fulfillmentType: z
        .nativeEnum(OnlineOrderFulfillmentType)
        .optional()
});
export async function getFinancialSummaryController(request, reply) {
    const query = getFinancialSummaryQuerySchema.parse(request.query);
    const organizationId = getTenantOrganizationId(request);
    const { summary } = await new FinancialAggregationService().execute({
        organizationId,
        userRole: request.user.role,
        ...query
    });
    return reply.status(200).send({
        summary
    });
}
