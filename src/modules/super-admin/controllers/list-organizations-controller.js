import { ListOrganizationsService } from '../services/list-organizations-service.js';
export async function listOrganizationsController(request, reply) {
    const service = new ListOrganizationsService();
    const organizations = await service.execute();
    return reply.send(organizations);
}
