import { prisma } from '../../../../lib/prisma.js';
import { AuditAction, CatalogProductPricingRule } from '@prisma/client';
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js';
export class CreateCatalogProductService {
    async execute({ organizationId, userId, categoryId, name, slug, description, imageUrl, priceInCents, pricingRule, supportsHalfAndHalf, canBeUsedAsFlavor, halfAndHalfFlavorCategoryId, sortOrder }) {
        const category = await prisma.catalogCategory.findFirst({
            where: {
                id: categoryId,
                organizationId
            }
        });
        if (!category) {
            throw new Error('Category not found');
        }
        if (supportsHalfAndHalf || pricingRule === CatalogProductPricingRule.MAX_SELECTED_FLAVOR) {
            const flavorCategoryId = halfAndHalfFlavorCategoryId ?? categoryId;
            const flavorCategory = await prisma.catalogCategory.findFirst({
                where: {
                    id: flavorCategoryId,
                    organizationId
                }
            });
            if (!flavorCategory) {
                throw new Error('Flavor category not found');
            }
        }
        const productWithSameSlug = await prisma.catalogProduct.findFirst({
            where: {
                organizationId,
                slug
            }
        });
        if (productWithSameSlug) {
            throw new Error('Product already exists');
        }
        const product = await prisma.catalogProduct.create({
            data: {
                organizationId,
                catalogCategoryId: categoryId,
                name,
                slug,
                description,
                imageUrl,
                priceInCents,
                pricingRule: pricingRule ?? CatalogProductPricingRule.STANDARD,
                supportsHalfAndHalf: supportsHalfAndHalf ??
                    pricingRule === CatalogProductPricingRule.MAX_SELECTED_FLAVOR,
                canBeUsedAsFlavor: canBeUsedAsFlavor ?? true,
                halfAndHalfFlavorCategoryId: supportsHalfAndHalf ||
                    pricingRule === CatalogProductPricingRule.MAX_SELECTED_FLAVOR
                    ? (halfAndHalfFlavorCategoryId ?? categoryId)
                    : null,
                sortOrder
            }
        });
        // Create audit log
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId,
            userId,
            entity: 'CatalogProduct',
            entityId: product.id,
            action: AuditAction.PRODUCT_CREATED,
            description: 'Produto criado',
            metadata: {
                productId: product.id,
                changedFields: [
                    'catalogCategoryId',
                    'name',
                    'slug',
                    'description',
                    'imageUrl',
                    'active',
                    'priceInCents',
                    'pricingRule',
                    'supportsHalfAndHalf',
                    'canBeUsedAsFlavor',
                    'halfAndHalfFlavorCategoryId',
                    'sortOrder'
                ],
                beforeData: null,
                afterData: {
                    catalogCategoryId: product.catalogCategoryId,
                    name: product.name,
                    slug: product.slug,
                    description: product.description,
                    imageUrl: product.imageUrl,
                    active: product.active,
                    priceInCents: product.priceInCents,
                    pricingRule: product.pricingRule,
                    supportsHalfAndHalf: product.supportsHalfAndHalf,
                    canBeUsedAsFlavor: product.canBeUsedAsFlavor,
                    halfAndHalfFlavorCategoryId: product.halfAndHalfFlavorCategoryId,
                    sortOrder: product.sortOrder
                }
            }
        });
        return {
            product
        };
    }
}
