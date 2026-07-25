import { PaymentProvider } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
import { GetMercadoPagoStatusService } from '../../payment-settings/services/get-mercado-pago-status-service.js';
import { PaymentSettingsResolver } from '../../payment-settings/payment-settings-resolver.js';
export class GetCheckoutPaymentSettingsService {
    async execute({ eventId }) {
        const event = await prisma.event.findUnique({
            where: {
                id: eventId
            },
            select: {
                id: true,
                name: true,
                organizationId: true,
                pixEnabled: true,
                pixKey: true,
                pixReceiverName: true,
                pixCity: true,
                pixInstructions: true
            }
        });
        if (!event) {
            throw new Error('Event not found');
        }
        const mercadoPagoProviderSettings = await prisma.paymentProviderSettings.findUnique({
            where: {
                organizationId_provider: {
                    organizationId: event.organizationId,
                    provider: PaymentProvider.MERCADO_PAGO
                }
            },
            select: {
                enabled: true,
                pixEnabled: true,
                cardEnabled: true,
                terminalEnabled: true,
                accessToken: true,
                publicKey: true,
                webhookSecret: true,
                webhookUrl: true
            }
        });
        const mercadoPagoStatus = await new GetMercadoPagoStatusService().execute({
            organizationId: event.organizationId
        });
        const effectiveSettings = await new PaymentSettingsResolver().resolve({
            organizationId: event.organizationId,
            contextType: 'EVENT',
            eventId: event.id
        });
        const mercadoPagoEnabled = mercadoPagoStatus.configured;
        const mercadoPagoPixEnabled = Boolean(mercadoPagoStatus.pixEnabled && effectiveSettings.methods.pix);
        const mercadoPagoAccessTokenConfigured = mercadoPagoStatus.configured;
        return {
            checkoutPaymentSettings: {
                event: {
                    id: event.id,
                    name: event.name
                },
                manualPix: {
                    enabled: event.pixEnabled,
                    pixKey: event.pixEnabled ? event.pixKey : null,
                    receiverName: event.pixEnabled ? event.pixReceiverName : null,
                    city: event.pixEnabled ? event.pixCity : null,
                    instructions: event.pixEnabled ? event.pixInstructions : null
                },
                mercadoPago: {
                    enabled: mercadoPagoEnabled,
                    pixEnabled: mercadoPagoPixEnabled,
                    cardEnabled: mercadoPagoProviderSettings?.cardEnabled ?? false,
                    terminalEnabled: mercadoPagoProviderSettings?.terminalEnabled ?? false,
                    accessTokenConfigured: mercadoPagoAccessTokenConfigured,
                    publicKeyConfigured: Boolean(mercadoPagoProviderSettings?.publicKey),
                    webhookSecretConfigured: Boolean(mercadoPagoProviderSettings?.webhookSecret),
                    webhookUrlConfigured: Boolean(mercadoPagoProviderSettings?.webhookUrl),
                    pixAutomaticAvailable: mercadoPagoEnabled &&
                        mercadoPagoPixEnabled &&
                        mercadoPagoAccessTokenConfigured
                }
            }
        };
    }
}
