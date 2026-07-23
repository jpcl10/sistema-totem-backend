import { ListPaymentProviderSettingsService } from '../services/list-payment-provider-settings-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
export async function listPaymentProviderSettingsController(request, reply) {
    const organizationId = getTenantOrganizationId(request);
    const listPaymentProviderSettingsService = new ListPaymentProviderSettingsService();
    const { settings } = await listPaymentProviderSettingsService.execute({
        organizationId
    });
    return reply.status(200).send({
        settings
    });
}
