import 'dotenv/config'
import { PrismaClient, DeviceType } from '@prisma/client'

const prisma = new PrismaClient()

function fmt(value: unknown) {
  return JSON.stringify(value, null, 2)
}

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true }
  })

  const events = await prisma.event.findMany({
    select: { id: true, name: true, slug: true, organizationId: true }
  })

  const stores = await prisma.onlineStore.findMany({
    where: { active: true },
    select: { id: true, name: true, slug: true, organizationId: true }
  })

  const devices = await prisma.device.findMany({
    where: { type: DeviceType.TOTEM },
    select: { id: true, name: true, code: true, status: true, organizationId: true, eventId: true, storeId: true }
  })

  console.log('ORGS', fmt(orgs))
  console.log('EVENTS', fmt(events))
  console.log('STORES', fmt(stores))
  console.log('TOTEM_DEVICES', fmt(devices))

  const candidateEvent = events[0]
  const candidateStore = stores[0]
  const candidateOrgId = candidateEvent?.organizationId ?? candidateStore?.organizationId ?? orgs[0]?.id

  if (candidateOrgId) {
    const orgPaymentSettings = await prisma.organizationPaymentSettings.findUnique({
      where: { organizationId: candidateOrgId }
    })

    const legacyProviderSettings = await prisma.paymentProviderSettings.findUnique({
      where: {
        organizationId_provider: {
          organizationId: candidateOrgId,
          provider: 'MERCADO_PAGO'
        }
      }
    })

    const modernCredential = await prisma.paymentProviderCredential.findFirst({
      where: {
        organizationId: candidateOrgId,
        provider: 'MERCADO_PAGO',
        active: true
      },
      orderBy: { updatedAt: 'desc' }
    })

    console.log('ORG_PAYMENT_SETTINGS', fmt(orgPaymentSettings))
    console.log('LEGACY_PROVIDER_SETTINGS', fmt(legacyProviderSettings))
    console.log('MODERN_CREDENTIAL', fmt({
      exists: Boolean(modernCredential),
      active: modernCredential?.active,
      encryptedCredentials: modernCredential?.encryptedCredentials ? '[REDACTED]' : null,
      environment: modernCredential?.environment,
      updatedAt: modernCredential?.updatedAt
    }))
  }

  if (candidateEvent) {
    const eventContextSettings = await prisma.contextPaymentSettings.findFirst({
      where: {
        organizationId: candidateEvent.organizationId,
        contextType: 'EVENT',
        eventId: candidateEvent.id
      }
    })
    console.log('EVENT_CONTEXT_SETTINGS', fmt(eventContextSettings))
  }

  if (candidateStore) {
    const storeContextSettings = await prisma.contextPaymentSettings.findFirst({
      where: {
        organizationId: candidateStore.organizationId,
        contextType: 'ONLINE_STORE',
        onlineStoreId: candidateStore.id
      }
    })
    console.log('STORE_CONTEXT_SETTINGS', fmt(storeContextSettings))
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
