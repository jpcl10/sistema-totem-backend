import { SettingsChannel } from '@prisma/client';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
import { OnlineStoreSettingsService } from '../../settings/services/online-store-settings-service.js';
import { onlineStoreAvailabilityParamsSchema } from '../schemas/online-store-availability-schema.js';
export async function getOnlineStoreAvailabilityController(request, reply) {
    const { storeId } = onlineStoreAvailabilityParamsSchema.parse(request.params);
    const organizationId = getTenantOrganizationId(request);
    try {
        const operation = await new OnlineStoreSettingsService().resolveOperation({
            organizationId,
            storeId,
            channel: SettingsChannel.DIGITAL_MENU
        });
        return reply.send({
            availability: operation.availability,
            operation: operation.delivery,
            onlineOrders: operation.onlineOrders,
            sources: operation.sources
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Store not found') {
            return reply.status(404).send({ message: 'Loja não encontrada' });
        }
        throw error;
    }
}
