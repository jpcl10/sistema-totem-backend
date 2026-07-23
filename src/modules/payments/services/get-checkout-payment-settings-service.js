import { PaymentProvider } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';
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
        const mercadoPagoSettings = await prisma.paymentProviderSettings.findUnique({
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
        const mercadoPagoEnabled = mercadoPagoSettings?.enabled ?? false;
        const mercadoPagoPixEnabled = mercadoPagoSettings?.pixEnabled ?? false;
        const mercadoPagoAccessTokenConfigured = Boolean(mercadoPagoSettings?.accessToken);
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
                    cardEnabled: mercadoPagoSettings?.cardEnabled ?? false,
                    terminalEnabled: mercadoPagoSettings?.terminalEnabled ?? false,
                    accessTokenConfigured: mercadoPagoAccessTokenConfigured,
                    publicKeyConfigured: Boolean(mercadoPagoSettings?.publicKey),
                    webhookSecretConfigured: Boolean(mercadoPagoSettings?.webhookSecret),
                    webhookUrlConfigured: Boolean(mercadoPagoSettings?.webhookUrl),
                    pixAutomaticAvailable: mercadoPagoEnabled &&
                        mercadoPagoPixEnabled &&
                        mercadoPagoAccessTokenConfigured
                }
            }
        };
    }
}
