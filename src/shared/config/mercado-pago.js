export const mercadoPagoConfig = {
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? '',
    publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY ?? '',
    webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? '',
    webhookUrl: process.env.MERCADO_PAGO_WEBHOOK_URL ?? ''
};
