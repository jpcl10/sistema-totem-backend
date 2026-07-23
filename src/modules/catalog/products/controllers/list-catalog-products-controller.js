import { ListCatalogProductsService } from '../services/list-catalog-products-service.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function listCatalogProductsController(request, reply) {
    const organizationId = getTenantOrganizationId(request);
    const service = new ListCatalogProductsService();
    const { products } = await service.execute({
        organizationId,
        userRole: request.user.role
    });
    return reply.send({
        products
    });
}
