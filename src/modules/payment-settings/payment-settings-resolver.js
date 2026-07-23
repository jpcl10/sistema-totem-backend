import { PaymentEnvironment, PaymentProvider } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
function clampPixExpiration(value) {
    return Math.min(Math.max(value, 2), 60);
}
function clampInstallments(value) {
    return Math.min(Math.max(value, 1), 24);
}
function applyOverride(organizationEnabled, override) {
    if (override === undefined || override === null) {
        return organizationEnabled;
    }
    return organizationEnabled && override;
}
export class PaymentSettingsResolver {
    async resolve({ organizationId, contextType, eventId, onlineStoreId }) {
        const organizationSettings = await prisma.organizationPaymentSettings.findUnique({
            where: {
                organizationId
            }
        });
        const legacyProviderSettings = await prisma.paymentProviderSettings.findMany({
            where: {
                organizationId
            },
            select: {
                provider: true,
                enabled: true,
                pixEnabled: true,
                cardEnabled: true,
                terminalEnabled: true,
                accessToken: true
            }
        });
        const legacyMercadoPago = legacyProviderSettings.find(setting => setting.provider === PaymentProvider.MERCADO_PAGO);
        const base = organizationSettings ?? {
            organizationId,
            pixEnabled: Boolean(legacyMercadoPago?.enabled && legacyMercadoPago.pixEnabled),
            creditEnabled: Boolean(legacyMercadoPago?.enabled && legacyMercadoPago.cardEnabled),
            debitEnabled: Boolean(legacyMercadoPago?.enabled && legacyMercadoPago.cardEnabled),
            cashEnabled: true,
            nfcBalanceEnabled: false,
            defaultProvider: legacyMercadoPago?.enabled
                ? PaymentProvider.MERCADO_PAGO
                : PaymentProvider.MANUAL,
            pixExpirationMinutes: 5,
            maxInstallments: 1,
            environment: PaymentEnvironment.PRODUCTION
        };
        const contextSettings = contextType
            ? await prisma.contextPaymentSettings.findFirst({
                where: {
                    organizationId,
                    contextType,
                    ...(eventId ? { eventId } : {}),
                    ...(onlineStoreId ? { onlineStoreId } : {})
                }
            })
            : null;
        const providerCredentials = await prisma.paymentProviderCredential.findMany({
            where: {
                organizationId,
                environment: base.environment
            },
            select: {
                provider: true,
                active: true,
                encryptedCredentials: true,
                environment: true
            }
        });
        const providers = new Map();
        for (const credential of providerCredentials) {
            providers.set(credential.provider, {
                provider: credential.provider,
                active: credential.active,
                configured: Boolean(credential.encryptedCredentials),
                environment: credential.environment
            });
        }
        for (const setting of legacyProviderSettings) {
            if (!providers.has(setting.provider)) {
                providers.set(setting.provider, {
                    provider: setting.provider,
                    active: setting.enabled,
                    configured: Boolean(setting.accessToken),
                    environment: base.environment
                });
            }
        }
        const contextId = eventId ?? onlineStoreId ?? null;
        return {
            organizationId,
            contextType: contextType ?? 'ORGANIZATION',
            contextId,
            methods: {
                pix: applyOverride(base.pixEnabled, contextSettings?.pixEnabledOverride),
                credit: applyOverride(base.creditEnabled, contextSettings?.creditEnabledOverride),
                debit: applyOverride(base.debitEnabled, contextSettings?.debitEnabledOverride),
                cash: applyOverride(base.cashEnabled, contextSettings?.cashEnabledOverride),
                nfcBalance: applyOverride(base.nfcBalanceEnabled, contextSettings?.nfcBalanceEnabledOverride)
            },
            defaultProvider: base.defaultProvider,
            pixExpirationMinutes: clampPixExpiration(base.pixExpirationMinutes),
            maxInstallments: clampInstallments(contextSettings?.maxInstallmentsOverride ??
                base.maxInstallments),
            environment: base.environment,
            providers: Array.from(providers.values()),
            inheritedFromOrganization: !contextSettings ||
                contextSettings.inheritOrganizationSettings
        };
    }
    async assertContextCanEnableMethods({ organizationId, pixEnabledOverride, creditEnabledOverride, debitEnabledOverride, cashEnabledOverride, nfcBalanceEnabledOverride }) {
        const effective = await this.resolve({ organizationId });
        const blocked = [
            ['pix', pixEnabledOverride, effective.methods.pix],
            ['credit', creditEnabledOverride, effective.methods.credit],
            ['debit', debitEnabledOverride, effective.methods.debit],
            ['cash', cashEnabledOverride, effective.methods.cash],
            ['nfcBalance', nfcBalanceEnabledOverride, effective.methods.nfcBalance]
        ];
        const invalid = blocked.find(([, override, enabled]) => override === true && !enabled);
        if (invalid) {
            throw new Error(`Payment method ${invalid[0]} is disabled at organization level`);
        }
    }
}
