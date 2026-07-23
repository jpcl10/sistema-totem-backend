import { prisma } from '../../../../lib/prisma.js';
import { AuditAction, CatalogProductPricingRule } from '@prisma/client';
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js';
const auditedProductFields = [
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
];
function pickProductAuditData(product) {
    return Object.fromEntries(auditedProductFields.map(field => [field, product[field]]));
}
function resolveProductAuditAction(beforeData, afterData, changedFields) {
    if (changedFields.length === 1 && changedFields[0] === 'active') {
        return afterData.active
            ? AuditAction.PRODUCT_ACTIVATED
            : AuditAction.PRODUCT_DEACTIVATED;
    }
    if (changedFields.length === 1 && changedFields[0] === 'supportsHalfAndHalf') {
        return afterData.supportsHalfAndHalf
            ? AuditAction.HALF_AND_HALF_ENABLED
            : AuditAction.HALF_AND_HALF_DISABLED;
    }
    if (changedFields.length === 1 && changedFields[0] === 'canBeUsedAsFlavor') {
        return afterData.canBeUsedAsFlavor
            ? AuditAction.FLAVOR_ELIGIBILITY_ENABLED
            : AuditAction.FLAVOR_ELIGIBILITY_DISABLED;
    }
    if (changedFields.length === 1 && changedFields[0] === 'priceInCents') {
        return AuditAction.PRODUCT_PRICE_CHANGED;
    }
    return AuditAction.PRODUCT_UPDATED;
}
export class UpdateCatalogProductService {
    async execute({ organizationId, userId, productId, categoryId, name, slug, description, imageUrl, active, priceInCents, pricingRule, supportsHalfAndHalf, canBeUsedAsFlavor, halfAndHalfFlavorCategoryId, sortOrder }) {
        const product = await prisma.catalogProduct.findFirst({
            where: {
                id: productId,
                organizationId
            }
        });
        if (!product) {
            throw new Error('Product not found');
        }
        if (categoryId) {
            const category = await prisma.catalogCategory.findFirst({
                where: {
                    id: categoryId,
                    organizationId
                }
            });
            if (!category) {
                throw new Error('Category not found');
            }
        }
        const effectivePricingRule = pricingRule ?? product.pricingRule;
        const effectiveSupportsHalfAndHalf = supportsHalfAndHalf ??
            product.supportsHalfAndHalf ??
            effectivePricingRule === CatalogProductPricingRule.MAX_SELECTED_FLAVOR;
        const effectiveHalfAndHalfFlavorCategoryId = effectiveSupportsHalfAndHalf ||
            effectivePricingRule === CatalogProductPricingRule.MAX_SELECTED_FLAVOR
            ? (halfAndHalfFlavorCategoryId !== undefined
                ? halfAndHalfFlavorCategoryId
                : (product.halfAndHalfFlavorCategoryId ?? product.catalogCategoryId))
            : null;
        if (effectiveHalfAndHalfFlavorCategoryId) {
            const flavorCategory = await prisma.catalogCategory.findFirst({
                where: {
                    id: effectiveHalfAndHalfFlavorCategoryId,
                    organizationId
                }
            });
            if (!flavorCategory) {
                throw new Error('Flavor category not found');
            }
        }
        const beforeData = pickProductAuditData(product);
        const updatedProduct = await prisma.catalogProduct.update({
            where: {
                id: productId
            },
            data: {
                ...(categoryId !== undefined && {
                    catalogCategoryId: categoryId
                }),
                ...(name !== undefined && {
                    name
                }),
                ...(slug !== undefined && {
                    slug
                }),
                ...(description !== undefined && {
                    description
                }),
                ...(imageUrl !== undefined && {
                    imageUrl
                }),
                ...(active !== undefined && {
                    active
                }),
                ...(priceInCents !== undefined && {
                    priceInCents
                }),
                ...(pricingRule !== undefined && {
                    pricingRule
                }),
                ...(supportsHalfAndHalf !== undefined && {
                    supportsHalfAndHalf
                }),
                ...(canBeUsedAsFlavor !== undefined && {
                    canBeUsedAsFlavor
                }),
                ...(halfAndHalfFlavorCategoryId !== undefined ||
                    pricingRule !== undefined ||
                    supportsHalfAndHalf !== undefined
                    ? {
                        halfAndHalfFlavorCategoryId: effectiveHalfAndHalfFlavorCategoryId
                    }
                    : {}),
                ...(sortOrder !== undefined && {
                    sortOrder
                })
            }
        });
        const afterData = pickProductAuditData(updatedProduct);
        const changedFields = auditedProductFields.filter(field => beforeData[field] !== afterData[field]);
        const action = resolveProductAuditAction(beforeData, afterData, changedFields);
        const createAuditLogService = new CreateAuditLogService();
        await createAuditLogService.execute({
            organizationId,
            userId,
            entity: 'CatalogProduct',
            entityId: updatedProduct.id,
            action,
            description: 'Produto atualizado',
            metadata: {
                productId: updatedProduct.id,
                changedFields,
                beforeData,
                afterData
            }
        });
        return {
            product: updatedProduct
        };
    }
}
