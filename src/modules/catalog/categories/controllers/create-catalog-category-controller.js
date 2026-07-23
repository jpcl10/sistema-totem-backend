import { CreateCatalogCategoryService } from '../services/create-catalog-category-service.js';
import { createCatalogCategorySchema } from '../schemas/create-catalog-category-schema.js';
import { getTenantOrganizationId } from '../../../auth/middlewares/request-context.js';
export async function createCatalogCategoryController(request, reply) {
    const body = createCatalogCategorySchema.parse(request.body);
    const organizationId = getTenantOrganizationId(request);
    const service = new CreateCatalogCategoryService();
    const { category } = await service.execute({
        organizationId,
        userRole: request.user.role,
        name: body.name,
        slug: body.slug,
        sector: body.sector,
        sortOrder: body.sortOrder
    });
    return reply.status(201).send({
        category
    });
}
