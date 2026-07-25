import pkg from '@prisma/client'
const { PrismaClient, PaymentProvider, PaymentContextType } = pkg
const prisma = new PrismaClient()

async function run() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, slug: true } })
  console.log('ORGS', JSON.stringify(orgs, null, 2))

  const events = await prisma.event.findMany({ where: { active: true }, select: { id: true, name: true, slug: true, organizationId: true, active: true, pixEnabled: true } })
  console.log('EVENTS', JSON.stringify(events, null, 2))

  const stores = await prisma.onlineStore.findMany({ where: { active: true }, select: { id: true, name: true, slug: true, organizationId: true, active: true } })
  console.log('STORES', JSON.stringify(stores, null, 2))

  const devices = await prisma.device.findMany({ where: { type: 'TOTEM' }, select: { id: true, name: true, code: true, organizationId: true, eventId: true, storeId: true, status: true } })
  console.log('DEVICES', JSON.stringify(devices, null, 2))

  const settings = await prisma.organizationPaymentSettings.findMany({ select: { organizationId: true, pixEnabled: true, environment: true, cashEnabled: true, creditEnabled: true, debitEnabled: true, nfcBalanceEnabled: true } })
  console.log('ORG_PAYMENT_SETTINGS', JSON.stringify(settings, null, 2))

  const legacy = await prisma.paymentProviderSettings.findMany({ where: { provider: PaymentProvider.MERCADO_PAGO }, select: { organizationId: true, enabled: true, pixEnabled: true, cardEnabled: true, accessToken: true, publicKey: true, terminalEnabled: true, webhookUrl: true } })
  console.log('LEGACY', JSON.stringify(legacy, null, 2))

  const credentials = await prisma.paymentProviderCredential.findMany({ where: { provider: PaymentProvider.MERCADO_PAGO }, select: { id: true, organizationId: true, environment: true, active: true, encryptedCredentials: true, publicMetadata: true, updatedAt: true } })
  console.log('CREDENTIALS', JSON.stringify(credentials, null, 2))

  const contextSettings = await prisma.contextPaymentSettings.findMany({ select: { id: true, organizationId: true, contextType: true, eventId: true, onlineStoreId: true, pixEnabledOverride: true, creditEnabledOverride: true, debitEnabledOverride: true, cashEnabledOverride: true, nfcBalanceEnabledOverride: true, inheritOrganizationSettings: true } })
  console.log('CONTEXT_SETTINGS', JSON.stringify(contextSettings, null, 2))

  await prisma.$disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
