import { AuditAction, UserRole } from '@prisma/client';
import { prisma } from '../../../../lib/prisma.js';
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js';
const INTERNAL_COMBO_CATEGORY_NAME = 'Itens do Combo';
function isInternalComboCategory(categoryName) {
    return categoryName.trim().toLowerCase() ===
        INTERNAL_COMBO_CATEGORY_NAME.toLowerCase();
}
export class SyncEventCatalogService {
    async execute({ organizationId, userId, userRole, eventId, dryRun }) {
        if (userRole !== UserRole.ADMIN &&
            userRole !== UserRole.SUPER_ADMIN) {
            throw new Error('Forbidden');
        }
        const result = await prisma.$transaction(async (tx) => {
            const event = await tx.event.findFirst({
                where: {
                    id: eventId,
                    organizationId
                },
                select: {
                    id: true,
                    organizationId: true
                }
            });
            if (!event) {
                throw new Error('Event not found');
            }
            const catalogProducts = await tx.catalogProduct.findMany({
                where: {
                    organizationId
                },
                include: {
                    catalogCategory: true
                },
                orderBy: [
                    {
                        catalogCategory: {
                            sortOrder: 'asc'
                        }
                    },
                    {
                        sortOrder: 'asc'
                    },
                    {
                        name: 'asc'
                    }
                ]
            });
            const existingEventProducts = await tx.eventProduct.findMany({
                where: {
                    eventId,
                    event: {
                        organizationId
                    }
                },
                select: {
                    catalogProductId: true
                }
            });
            const existingCatalogProductIds = new Set(existingEventProducts.map(eventProduct => eventProduct.catalogProductId));
            const skippedItems = [];
            const eligibleItems = [];
            for (const product of catalogProducts) {
                const item = {
                    productId: product.id,
                    productName: product.name,
                    categoryId: product.catalogCategory.id,
                    categoryName: product.catalogCategory.name
                };
                if (!product.active) {
                    skippedItems.push({
                        ...item,
                        reason: 'INACTIVE_PRODUCT'
                    });
                    continue;
                }
                if (!product.catalogCategory.active) {
                    skippedItems.push({
                        ...item,
                        reason: 'INACTIVE_CATEGORY'
                    });
                    continue;
                }
                if (isInternalComboCategory(product.catalogCategory.name)) {
                    skippedItems.push({
                        ...item,
                        reason: 'INTERNAL_COMBO_CATEGORY'
                    });
                    continue;
                }
                eligibleItems.push(item);
            }
            const productsToCreate = eligibleItems.filter(item => !existingCatalogProductIds.has(item.productId));
            if (!dryRun && productsToCreate.length > 0) {
                for (const item of productsToCreate) {
                    await tx.eventProduct.create({
                        data: {
                            eventId,
                            catalogProductId: item.productId,
                            priceInCents: null,
                            active: true,
                            soldOut: false,
                            trackStock: false,
                            stockQuantity: null
                        }
                    });
                }
            }
            return {
                eventId: event.id,
                totalCatalogProducts: catalogProducts.length,
                eligible: eligibleItems.length,
                alreadyLinked: eligibleItems.length - productsToCreate.length,
                created: dryRun ? 0 : productsToCreate.length,
                wouldCreate: dryRun ? productsToCreate.length : 0,
                skipped: skippedItems.length,
                createdItems: dryRun ? [] : productsToCreate,
                wouldCreateItems: dryRun ? productsToCreate : [],
                skippedItems
            };
        });
        if (!dryRun && result.created > 0) {
            const createAuditLogService = new CreateAuditLogService();
            await createAuditLogService.execute({
                organizationId,
                eventId,
                userId,
                entity: 'EventProduct',
                entityId: eventId,
                action: AuditAction.EVENT_PRODUCT_CREATED,
                description: 'Catalogo sincronizado com o evento',
                metadata: {
                    dryRun,
                    eventId,
                    totalCatalogProducts: result.totalCatalogProducts,
                    eligible: result.eligible,
                    created: result.created,
                    alreadyLinked: result.alreadyLinked,
                    skipped: result.skipped,
                    productIds: result.createdItems.length <= 100
                        ? result.createdItems.map(item => item.productId)
                        : undefined
                }
            });
        }
        return {
            ...result,
            dryRun
        };
    }
}
