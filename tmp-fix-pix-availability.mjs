import 'dotenv/config'
import pkg from '@prisma/client'
import { encryptPaymentCredentials } from './src/modules/payment-settings/payment-credentials-crypto.js'

const { PrismaClient, PaymentProvider, PaymentEnvironment } = pkg
const prisma = new PrismaClient()

async function run() {
  const organizationId = 'cmra0xvea000rvwasonliufxu'
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? 'seu-access-token'
  const publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY ?? 'sua-public-key'
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? 'seu-webhook-secret'
  const webhookUrl = process.env.MERCADO_PAGO_WEBHOOK_URL ?? 'https://seu-backend.com/webhooks/mercado-pago'

  const encrypted = encryptPaymentCredentials({
    accessToken,
    publicKey,
    webhookSecret,
    webhookUrl,
    accountReference: '0000'
  })

  const credential = await prisma.paymentProviderCredential.upsert({
    where: {
      organizationId_provider_environment: {
        organizationId,
        provider: PaymentProvider.MERCADO_PAGO,
        environment: PaymentEnvironment.PRODUCTION
      }
    },
    create: {
      organizationId,
      provider: PaymentProvider.MERCADO_PAGO,
      environment: PaymentEnvironment.PRODUCTION,
      active: true,
      encryptedCredentials: encrypted.encryptedPayload,
      publicMetadata: {
        accountReference: '0000',
        publicKey,
        webhookUrl
      }
    },
    update: {
      active: true,
      encryptedCredentials: encrypted.encryptedPayload,
      updatedAt: new Date()
    }
  })

  const org = await prisma.organizationPaymentSettings.update({
    where: { organizationId },
    data: { pixEnabled: true }
  })

  console.log('UPDATED_ORGANIZATION_PAYMENT_SETTINGS', JSON.stringify(org, null, 2))
  console.log('UPSERTED_CREDENTIAL', JSON.stringify({ id: credential.id, organizationId: credential.organizationId, active: credential.active, environment: credential.environment }, null, 2))

  await prisma.$disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
