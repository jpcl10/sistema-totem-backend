import { ListCatalogCategoriesService } from '../services/list-catalog-categories-service.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function listCatalogCategoriesController(request, reply) {
    const organizationId = getTenantOrganizationId(request);
    const service = new ListCatalogCategoriesService();
    const { categories } = await service.execute({
        organizationId,
        userRole: request.user.role
    });
    return reply.send({
        categories
    });
}
