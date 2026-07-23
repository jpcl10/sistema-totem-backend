export function catalogProductInclude(activeOptionsOnly = false) {
    return {
        catalogCategory: true,
        optionGroups: {
            ...(activeOptionsOnly
                ? {
                    where: {
                        active: true
                    }
                }
                : {}),
            include: {
                options: {
                    ...(activeOptionsOnly
                        ? {
                            where: {
                                active: true
                            }
                        }
                        : {}),
                    include: {
                        linkedProduct: true
                    },
                    orderBy: {
                        sortOrder: 'asc'
                    }
                }
            },
            orderBy: {
                sortOrder: 'asc'
            }
        }
    };
}
export function formatOptionGroups(product) {
    return product.optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        required: group.required,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
        active: group.active,
        options: group.options.map((option) => ({
            id: option.id,
            name: option.name,
            description: option.description,
            priceDeltaInCents: option.priceDeltaInCents,
            linkedProductId: option.linkedProductId,
            sortOrder: option.sortOrder,
            active: option.active,
            linkedProduct: option.linkedProduct
                ? {
                    id: option.linkedProduct.id,
                    name: option.linkedProduct.name,
                    imageUrl: option.linkedProduct.imageUrl
                }
                : null
        }))
    }));
}
export function formatEventProduct(eventProduct) {
    const product = eventProduct.catalogProduct;
    const catalogPriceInCents = product.priceInCents;
    const eventPriceInCents = eventProduct.priceInCents;
    const priceInCents = eventPriceInCents ?? catalogPriceInCents;
    const priceSource = eventPriceInCents === null ? 'CATALOG' : 'EVENT';
    return {
        id: eventProduct.id,
        catalogProductId: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        category: {
            id: product.catalogCategory.id,
            name: product.catalogCategory.name,
            slug: product.catalogCategory.slug,
            sector: product.catalogCategory.sector
        },
        catalogPriceInCents,
        eventPriceInCents,
        priceInCents,
        priceSource,
        optionGroups: formatOptionGroups(product),
        active: eventProduct.active,
        soldOut: eventProduct.soldOut,
        trackStock: eventProduct.trackStock,
        stockQuantity: eventProduct.stockQuantity,
        createdAt: eventProduct.createdAt,
        updatedAt: eventProduct.updatedAt
    };
}
export function formatAvailableCatalogProduct(product, alreadyLinked) {
    return {
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        category: {
            id: product.catalogCategory.id,
            name: product.catalogCategory.name,
            slug: product.catalogCategory.slug,
            sector: product.catalogCategory.sector
        },
        catalogPriceInCents: product.priceInCents,
        optionGroups: formatOptionGroups(product),
        alreadyLinked
    };
}
