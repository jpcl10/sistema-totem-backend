import { PaymentProvider } from '@prisma/client';
import { z } from 'zod';
import { UpsertPaymentProviderSettingService } from '../services/upsert-payment-provider-setting-service.js';
import { getTenantOrganizationId } from '../../auth/middlewares/request-context.js';
const upsertPaymentProviderSettingParamsSchema = z.object({
    provider: z.nativeEnum(PaymentProvider)
});
const upsertPaymentProviderSettingBodySchema = z.object({
    enabled: z.boolean().optional(),
    pixEnabled: z.boolean().optional(),
    cardEnabled: z.boolean().optional(),
    terminalEnabled: z.boolean().optional(),
    accessToken: z.string().nullable().optional(),
    publicKey: z.string().nullable().optional(),
    webhookSecret: z.string().nullable().optional(),
    webhookUrl: z.string().nullable().optional()
});
export async function upsertPaymentProviderSettingController(request, reply) {
    const { provider } = upsertPaymentProviderSettingParamsSchema.parse(request.params);
    const { enabled, pixEnabled, cardEnabled, terminalEnabled, accessToken, publicKey, webhookSecret, webhookUrl } = upsertPaymentProviderSettingBodySchema.parse(request.body);
    const userId = request.user.sub;
    const organizationId = getTenantOrganizationId(request);
    const upsertPaymentProviderSettingService = new UpsertPaymentProviderSettingService();
    const { setting } = await upsertPaymentProviderSettingService.execute({
        organizationId,
        userId,
        provider,
        enabled,
        pixEnabled,
        cardEnabled,
        terminalEnabled,
        accessToken,
        publicKey,
        webhookSecret,
        webhookUrl
    });
    return reply.status(200).send({
        setting
    });
}
