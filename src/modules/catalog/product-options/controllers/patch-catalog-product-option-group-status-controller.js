import { PatchCatalogProductOptionGroupStatusService } from '../services/patch-catalog-product-option-group-status-service.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function patchCatalogProductOptionGroupStatusController(request, reply) {
    const params = request.params;
    const body = request.body;
    const userId = request.user.sub;
    const organizationId = getTenantOrganizationId(request);
    const service = new PatchCatalogProductOptionGroupStatusService();
    const { optionGroup } = await service.execute({
        organizationId,
        userRole: request.user.role,
        userId,
        groupId: params.groupId,
        active: body.active
    });
    return reply.status(200).send({
        optionGroup
    });
}
