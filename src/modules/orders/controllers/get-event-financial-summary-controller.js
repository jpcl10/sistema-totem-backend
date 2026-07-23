import { z } from 'zod';
import { GetEventFinancialSummaryService } from '../services/get-event-financial-summary-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const getEventFinancialSummaryParamsSchema = z.object({
    eventId: z.string().min(1)
});
const getEventFinancialSummaryQuerySchema = z.object({
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
        .default('EVENT'),
    startDate: z
        .string()
        .optional(),
    endDate: z
        .string()
        .optional()
});
export async function getEventFinancialSummaryController(request, reply) {
    const { eventId } = getEventFinancialSummaryParamsSchema.parse(request.params);
    const { period, startDate, endDate } = getEventFinancialSummaryQuerySchema.parse(request.query);
    const organizationId = getTenantOrganizationId(request);
    const getEventFinancialSummaryService = new GetEventFinancialSummaryService();
    const { summary } = await getEventFinancialSummaryService.execute({
        organizationId,
        userRole: request.user.role,
        eventId,
        period,
        startDate,
        endDate
    });
    return reply.status(200).send({
        summary
    });
}
