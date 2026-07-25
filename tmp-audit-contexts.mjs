import pkg from '@prisma/client'
const { PrismaClient, PaymentProvider, DeviceType, DeviceStatus } = pkg
const prisma = new PrismaClient()

async function run() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, slug: true } })
  console.log(JSON.stringify({ orgs }, null, 2))

  const events = await prisma.event.findMany({ where: { active: true }, select: { id: true, name: true, slug: true, organizationId: true, active: true } })
  console.log(JSON.stringify({ events }, null, 2))

  const stores = await prisma.onlineStore.findMany({ where: { active: true }, select: { id: true, name: true, slug: true, organizationId: true, active: true } })
  console.log(JSON.stringify({ stores }, null, 2))

  const devices = await prisma.device.findMany({ where: { type: DeviceType.TOTEM, status: DeviceStatus.ACTIVE }, select: { id: true, name: true, code: true, organizationId: true, eventId: true, storeId: true, status: true, type: true } })
  console.log(JSON.stringify({ devices }, null, 2))

  const creds = await prisma.paymentProviderCredential.findMany({ where: { provider: PaymentProvider.MERCADO_PAGO, active: true }, select: { id: true, organizationId: true, environment: true, active: true, createdAt: true, updatedAt: true } })
  console.log(JSON.stringify({ creds }, null, 2))

  await prisma.$disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
