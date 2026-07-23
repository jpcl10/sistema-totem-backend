import { HealthService } from '../services/health-service.js';
export async function healthController(request, reply) {
    const service = new HealthService();
    const healthData = await service.execute();
    const statusCode = healthData.status === 'ok' || healthData.status === 'degraded'
        ? 200
        : 503;
    return reply.status(statusCode).send(healthData);
}
