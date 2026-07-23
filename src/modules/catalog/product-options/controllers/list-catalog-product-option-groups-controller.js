import { ListCatalogProductOptionGroupsService } from '../services/list-catalog-product-option-groups-service.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function listCatalogProductOptionGroupsController(request, reply) {
    const params = request.params;
    const organizationId = getTenantOrganizationId(request);
    const service = new ListCatalogProductOptionGroupsService();
    const { optionGroups } = await service.execute({
        organizationId,
        userRole: request.user.role,
        productId: params.productId
    });
    return reply.status(200).send({
        optionGroups
    });
}
