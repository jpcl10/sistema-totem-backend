import { updateCatalogCategorySchema } from '../schemas/update-catalog-category-schema.js';
import { UpdateCatalogCategoryService } from '../services/update-catalog-category-service.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function updateCatalogCategoryController(request, reply) {
    const params = request.params;
    const body = updateCatalogCategorySchema.parse(request.body);
    const organizationId = getTenantOrganizationId(request);
    const service = new UpdateCatalogCategoryService();
    const { category } = await service.execute({
        organizationId,
        userRole: request.user.role,
        categoryId: params.id,
        name: body.name,
        slug: body.slug,
        sector: body.sector,
        active: body.active,
        sortOrder: body.sortOrder
    });
    return reply.send({
        category
    });
}
