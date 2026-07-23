import { PaymentProvider } from '@prisma/client';
import { ManualPaymentProvider } from './manual-payment-provider.js';
import { MercadoPagoProvider } from './mercado-pago-provider.js';
export function makePaymentProvider(provider) {
    switch (provider) {
        case PaymentProvider.MANUAL:
            return new ManualPaymentProvider();
        case PaymentProvider.MERCADO_PAGO:
            return new MercadoPagoProvider();
        default:
            throw new Error(`Payment provider ${provider} is not implemented yet`);
    }
}
