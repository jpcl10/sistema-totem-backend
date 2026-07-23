import { AuditAction } from '@prisma/client';
import { prisma } from '../../../../lib/prisma.js';
import { CreateAuditLogService } from '../../../audit-logs/services/create-audit-log-service.js';
import { catalogProductInclude, formatEventProduct } from './event-product-presenter.js';
export class BulkCreateEventProductsService {
    async execute({ organizationId, userId, eventId, products }) {
        const normalizedProducts = products.map(product => {
            if (product.trackStock && product.stockQuantity === undefined) {
                throw new Error('Stock quantity is required when stock tracking is enabled');
            }
            return {
                ...product,
                priceInCents: product.priceInCents ?? null,
                stockQuantity: product.trackStock
                    ? product.stockQuantity
                    : null
            };
        });
        const uniqueCatalogProductIds = [
            ...new Set(normalizedProducts.map(product => product.catalogProductId))
        ];
        if (uniqueCatalogProductIds.length !== normalizedProducts.length) {
            throw new Error('Duplicated catalog product in request');
        }
        const result = await prisma.$transaction(async (tx) => {
            const event = await tx.event.findFirst({
                where: {
                    id: eventId,
                    organizationId
                },
                select: {
                    id: true
                }
            });
            if (!event) {
                throw new Error('Event not found');
            }
            const catalogProducts = await tx.catalogProduct.findMany({
                where: {
                    id: {
                        in: uniqueCatalogProductIds
                    },
                    organizationId
                },
                select: {
                    id: true
                }
            });
            if (catalogProducts.length !== uniqueCatalogProductIds.length) {
                throw new Error('Catalog product not found');
            }
            const existing = await tx.eventProduct.findMany({
                where: {
                    eventId,
                    catalogProductId: {
                        in: uniqueCatalogProductIds
                    },
                    event: {
                        organizationId
                    }
                },
                include: {
                    catalogProduct: {
                        include: catalogProductInclude()
                    }
                }
            });
            const existingCatalogProductIds = new Set(existing.map(eventProduct => eventProduct.catalogProductId));
            const productsToCreate = normalizedProducts.filter(product => !existingCatalogProductIds.has(product.catalogProductId));
            const created = [];
            for (const product of productsToCreate) {
                const createdEventProduct = await tx.eventProduct.create({
                    data: {
                        eventId,
                        catalogProductId: product.catalogProductId,
                        priceInCents: product.priceInCents,
                        active: product.active,
                        trackStock: product.trackStock,
                        stockQuantity: product.stockQuantity
                    },
                    include: {
                        catalogProduct: {
                            include: catalogProductInclude()
                        }
                    }
                });
                created.push(createdEventProduct);
            }
            return {
                created,
                existing
            };
        });
        if (result.created.length > 0) {
            const createAuditLogService = new CreateAuditLogService();
            await createAuditLogService.execute({
                organizationId,
                eventId,
                userId,
                entity: 'EventProduct',
                entityId: eventId,
                action: AuditAction.EVENT_PRODUCT_CREATED,
                description: 'Produtos adicionados ao evento em lote',
                metadata: {
                    created: result.created.map(eventProduct => eventProduct.catalogProductId),
                    existing: result.existing.map(eventProduct => eventProduct.catalogProductId)
                }
            });
        }
        return {
            created: result.created.map(formatEventProduct),
            existing: result.existing.map(formatEventProduct),
            summary: {
                created: result.created.length,
                existing: result.existing.length
            }
        };
    }
}
