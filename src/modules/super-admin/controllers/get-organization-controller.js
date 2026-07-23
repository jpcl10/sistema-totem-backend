import { z } from 'zod';
import { GetOrganizationService } from '../services/get-organization-service.js';
const getOrganizationParamsSchema = z.object({
    id: z.string().min(1)
});
export async function getOrganizationController(request, reply) {
    const { id } = getOrganizationParamsSchema.parse(request.params);
    const service = new GetOrganizationService();
    try {
        const result = await service.execute(id);
        return reply.send(result);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Organization not found') {
            return reply.status(404).send({ message: 'Organization not found' });
        }
        throw error;
    }
}
