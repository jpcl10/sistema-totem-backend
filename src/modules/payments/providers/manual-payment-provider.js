import { PaymentProvider, PaymentTransactionStatus } from '@prisma/client';
export class ManualPaymentProvider {
    async createPayment(data) {
        return {
            provider: PaymentProvider.MANUAL,
            status: PaymentTransactionStatus.CREATED,
            method: data.method,
            amountInCents: data.amountInCents,
            externalId: null,
            externalReference: `manual-${data.orderId}-${Date.now()}`,
            qrCode: null,
            qrCodeBase64: null,
            pixCopyPaste: null,
            gatewayStatus: 'created',
            gatewayMessage: 'Pagamento manual criado',
            metadata: {
                source: 'manual-provider',
                organizationId: data.organizationId,
                orderId: data.orderId
            }
        };
    }
}
