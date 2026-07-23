export const invalidConfigurableItemMessage = 'Produto inv\u00e1lido ou indispon\u00edvel.';
function isDuplicate(values) {
    return new Set(values).size !== values.length;
}
function validateSelectedOptions(selectedOptions = []) {
    const selectedOptionsMap = new Map();
    for (const selected of selectedOptions) {
        if (selectedOptionsMap.has(selected.optionGroupId)) {
            throw new Error(`Grupo de op\u00e7\u00f5es duplicado: ${selected.optionGroupId}`);
        }
        if (isDuplicate(selected.optionIds)) {
            throw new Error(`Op\u00e7\u00f5es duplicadas no grupo: ${selected.optionGroupId}`);
        }
        selectedOptionsMap.set(selected.optionGroupId, selected.optionIds);
    }
    return selectedOptionsMap;
}
function isSizeGroup(group) {
    return /(tamanho|size|pizza-size)/i.test(group.key ?? '') || /(tamanho|size)/i.test(group.name ?? '');
}
function resolveSizeOptionData(product, selectedOptionsMap) {
    const sizeGroup = product.optionGroups.find(group => isSizeGroup(group));
    if (!sizeGroup) {
        return {
            selectedSizeOption: null,
            sizeDeltaInCents: 0
        };
    }
    const selectedSizeOptionId = selectedOptionsMap.get(sizeGroup.id)?.[0] ?? null;
    const selectedSizeOption = selectedSizeOptionId
        ? sizeGroup.options.find(option => option.id === selectedSizeOptionId) ?? null
        : null;
    return {
        selectedSizeOption,
        sizeDeltaInCents: selectedSizeOption?.priceDeltaInCents ?? 0
    };
}
export async function buildConfigurableCatalogOrderItems({ tx, organizationId, items }) {
    const productIds = items.map(item => item.catalogProductId);
    const products = await tx.catalogProduct.findMany({
        where: {
            id: { in: productIds },
            organizationId,
            active: true
        },
        include: {
            optionGroups: {
                where: {
                    active: true
                },
                include: {
                    options: {
                        where: {
                            active: true
                        }
                    }
                }
            }
        }
    });
    const productMap = new Map(products.map(product => [product.id, product]));
    const allFlavorIds = items.flatMap(item => item.selectedFlavorProductIds ?? []);
    const flavorProducts = allFlavorIds.length > 0
        ? await tx.catalogProduct.findMany({
            where: {
                id: { in: allFlavorIds },
                organizationId,
                active: true
            },
            include: {
                optionGroups: {
                    where: {
                        active: true
                    },
                    include: {
                        options: {
                            where: {
                                active: true
                            }
                        }
                    }
                }
            }
        })
        : [];
    const flavorMap = new Map(flavorProducts.map(product => [product.id, product]));
    const orderItemsData = [];
    let subtotalInCents = 0;
    for (const item of items) {
        const product = productMap.get(item.catalogProductId);
        if (!product) {
            throw new Error(invalidConfigurableItemMessage);
        }
        const selectedOptionsMap = validateSelectedOptions(item.selectedOptions);
        const optionSnapshots = [];
        let optionsTotalDeltaInCents = 0;
        const sizeResolution = resolveSizeOptionData(product, selectedOptionsMap);
        const primaryFullPriceInCents = product.priceInCents + sizeResolution.sizeDeltaInCents;
        for (const group of product.optionGroups) {
            const selectedOptionIds = selectedOptionsMap.get(group.id) || [];
            if (group.required && selectedOptionIds.length === 0) {
                throw new Error(`O grupo de op\u00e7\u00f5es "${group.name}" \u00e9 obrigat\u00f3rio`);
            }
            if (selectedOptionIds.length < group.minSelections) {
                throw new Error(`O grupo de op\u00e7\u00f5es "${group.name}" requer pelo menos ${group.minSelections} sele\u00e7\u00f5es`);
            }
            if (selectedOptionIds.length > group.maxSelections) {
                throw new Error(`O grupo de op\u00e7\u00f5es "${group.name}" permite no m\u00e1ximo ${group.maxSelections} sele\u00e7\u00f5es`);
            }
            for (const optionId of selectedOptionIds) {
                const option = group.options.find(currentOption => currentOption.id === optionId);
                if (!option) {
                    throw new Error(`Op\u00e7\u00e3o "${optionId}" n\u00e3o encontrada no grupo "${group.name}"`);
                }
                if (!isSizeGroup(group)) {
                    optionsTotalDeltaInCents += option.priceDeltaInCents;
                }
                let linkedProductName = null;
                if (option.linkedProductId) {
                    const linkedProduct = await tx.catalogProduct.findFirst({
                        where: {
                            id: option.linkedProductId,
                            organizationId,
                            active: true
                        },
                        select: {
                            name: true
                        }
                    });
                    if (linkedProduct) {
                        linkedProductName = linkedProduct.name;
                    }
                }
                optionSnapshots.push({
                    optionGroupId: group.id,
                    optionId: option.id,
                    linkedProductId: option.linkedProductId,
                    groupName: group.name,
                    optionName: linkedProductName || option.name,
                    priceDeltaInCents: option.priceDeltaInCents
                });
            }
            selectedOptionsMap.delete(group.id);
        }
        if (selectedOptionsMap.size > 0) {
            const unknownGroupIds = Array.from(selectedOptionsMap.keys());
            throw new Error(`Grupos de op\u00e7\u00f5es desconhecidos: ${unknownGroupIds.join(', ')}`);
        }
        const selectedFlavorIds = item.selectedFlavorProductIds ?? [];
        let basePriceInCents = primaryFullPriceInCents;
        let pricingSnapshot = {
            pricingMode: 'STANDARD',
            pricingRule: 'PRODUCT_PRICE_PLUS_OPTIONS',
            product: {
                productId: product.id,
                name: product.name,
                fullPriceInCents: primaryFullPriceInCents
            },
            basePriceInCents,
            selectedOptionsTotalInCents: optionsTotalDeltaInCents,
            unitPriceInCents: 0,
            quantity: item.quantity,
            totalInCents: 0
        };
        const flavorSnapshots = [];
        if (selectedFlavorIds.length > 0) {
            if (!product.supportsHalfAndHalf) {
                throw new Error('Este produto n\u00e3o aceita pizza meio a meio.');
            }
            if (selectedFlavorIds.length !== 1) {
                throw new Error('Selecione exatamente um segundo sabor para a pizza meio a meio.');
            }
            const secondFlavor = flavorMap.get(selectedFlavorIds[0]);
            if (!secondFlavor) {
                throw new Error('Sabor inv\u00e1lido ou indispon\u00edvel.');
            }
            const allowedFlavorCategoryId = product.halfAndHalfFlavorCategoryId ?? product.catalogCategoryId;
            const secondFlavorSizeGroup = secondFlavor.optionGroups.find(group => isSizeGroup(group));
            const secondFlavorSizeOption = sizeResolution.selectedSizeOption?.key && secondFlavorSizeGroup
                ? secondFlavorSizeGroup.options.find(option => option.key === sizeResolution.selectedSizeOption?.key) ?? null
                : null;
            const secondFlavorFullPriceInCents = secondFlavor.priceInCents + (secondFlavorSizeOption?.priceDeltaInCents ?? 0);
            if (secondFlavor.organizationId !== organizationId ||
                secondFlavor.catalogCategoryId !== allowedFlavorCategoryId ||
                !secondFlavor.canBeUsedAsFlavor ||
                secondFlavor.pricingRule === 'MAX_SELECTED_FLAVOR') {
                throw new Error('Sabor inv\u00e1lido ou indispon\u00edvel.');
            }
            basePriceInCents = Math.max(primaryFullPriceInCents, secondFlavorFullPriceInCents);
            pricingSnapshot = {
                pricingMode: 'HALF_AND_HALF',
                pricingRule: 'MOST_EXPENSIVE_FLAVOR',
                formula: 'Math.max(primaryFullPriceInCents, secondFlavorFullPriceInCents)',
                primaryFlavor: {
                    productId: product.id,
                    name: product.name,
                    fullPriceInCents: primaryFullPriceInCents
                },
                secondFlavor: {
                    productId: secondFlavor.id,
                    name: secondFlavor.name,
                    fullPriceInCents: secondFlavorFullPriceInCents
                },
                basePriceInCents,
                selectedOptionsTotalInCents: optionsTotalDeltaInCents,
                unitPriceInCents: 0,
                quantity: item.quantity,
                totalInCents: 0
            };
            flavorSnapshots.push({
                catalogProductId: product.id,
                position: 1,
                flavorName: product.name,
                priceInCents: primaryFullPriceInCents
            }, {
                catalogProductId: secondFlavor.id,
                position: 2,
                flavorName: secondFlavor.name,
                priceInCents: secondFlavorFullPriceInCents
            });
        }
        const unitPriceInCents = basePriceInCents + optionsTotalDeltaInCents;
        const itemTotalInCents = unitPriceInCents * item.quantity;
        pricingSnapshot.unitPriceInCents = unitPriceInCents;
        pricingSnapshot.totalInCents = itemTotalInCents;
        subtotalInCents += itemTotalInCents;
        orderItemsData.push({
            catalogProductId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPriceInCents,
            totalInCents: itemTotalInCents,
            notes: item.notes ?? undefined,
            pricingSnapshot: pricingSnapshot,
            options: {
                create: optionSnapshots
            },
            flavors: {
                create: flavorSnapshots
            }
        });
    }
    return {
        orderItemsData,
        subtotalInCents
    };
}
export function isConfigurableOrderItemValidationError(message) {
    return (message === invalidConfigurableItemMessage ||
        message === 'Sabor inv\u00e1lido ou indispon\u00edvel.' ||
        message === 'Selecione exatamente um segundo sabor para a pizza meio a meio.' ||
        message === 'Este produto n\u00e3o aceita pizza meio a meio.' ||
        message.startsWith('Grupo de op\u00e7\u00f5es duplicado:') ||
        message.startsWith('Op\u00e7\u00f5es duplicadas no grupo:') ||
        message.startsWith('O grupo de op\u00e7\u00f5es "') ||
        message.startsWith('Op\u00e7\u00e3o "') ||
        message.startsWith('Grupos de op\u00e7\u00f5es desconhecidos:'));
}
