import { buildConfigurableCatalogOrderItems, isConfigurableOrderItemValidationError } from '../../orders/services/configurable-order-item-builder.js';
export async function buildOnlineOrderItems(request) {
    return buildConfigurableCatalogOrderItems(request);
}
export function isOnlineOrderItemValidationError(message) {
    return isConfigurableOrderItemValidationError(message);
}
