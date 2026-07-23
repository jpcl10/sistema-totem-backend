import { z } from 'zod';
import { GetEventMetricsService } from '../services/get-event-metrics-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const getEventMetricsParamsSchema = z.object({
    eventId: z.string().min(1)
});
const getEventMetricsQuerySchema = z.object({
    period: z
        .enum([
        'EVENT',
        'TODAY',
        '24H',
        '7D',
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
export async function getEventMetricsController(request, reply) {
    const { eventId } = getEventMetricsParamsSchema.parse(request.params);
    const { period, startDate, endDate } = getEventMetricsQuerySchema.parse(request.query);
    const service = new GetEventMetricsService();
    const organizationId = getTenantOrganizationId(request);
    const { metrics } = await service.execute({
        organizationId,
        eventId,
        period,
        startDate,
        endDate
    });
    return reply.status(200).send({
        metrics
    });
}
