
import "dotenv/config";
import { PrismaClient } from '@prisma/client'

console.log('DATABASE_URL carregada:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@') : 'NÃO ENCONTRADA');
console.log('Diretório atual:', process.cwd());
console.log();

const prisma = new PrismaClient()

async function main() {
  console.log('=== AUDITORIA DO BANCO DE DADOS ===\n')

  // 1. Organization
  console.log('--- ORGANIZATIONS ---')
  const organizations = await prisma.organization.findMany({
    include: { organizationModules: true, users: true, onlineStores: true }
  })
  console.log(`Total: ${organizations.length}`)
  organizations.forEach(org => {
    console.log(`  - ${org.name} (slug: ${org.slug}, id: ${org.id})`)
    console.log(`    - Users: ${org.users.length}`)
    console.log(`    - Modules enabled: ${org.organizationModules.filter(m => m.enabled).length}`)
    console.log(`    - Online Stores: ${org.onlineStores.length}`)
  })
  console.log()

  // 2. Events
  console.log('--- EVENTS ---')
  const events = await prisma.event.findMany({
    include: { orders: true, nfcCards: true }
  })
  console.log(`Total: ${events.length}`)
  events.forEach(evt => {
    console.log(`  - ${evt.name} (slug: ${evt.slug}, org: ${evt.organizationId})`)
    console.log(`    - Orders: ${evt.orders.length}`)
    console.log(`    - NFC Cards: ${evt.nfcCards.length}`)
  })
  console.log()

  // 3. NFC Cards
  console.log('--- NFC CARDS ---')
  const nfcCards = await prisma.nfcCard.findMany({
    include: { nfcCardTransactions: true }
  })
  console.log(`Total: ${nfcCards.length}`)
  nfcCards.forEach(card => {
    console.log(`  - UID: ${card.uid} | Balance: ${card.balanceInCents} cents | Transactions: ${card.nfcCardTransactions.length}`)
  })
  console.log()

  // 4. NFC Transactions
  console.log('--- NFC CARD TRANSACTIONS ---')
  const nfcTransactions = await prisma.nfcCardTransaction.findMany()
  console.log(`Total: ${nfcTransactions.length}`)
  console.log()

  // 5. Orders
  console.log('--- ORDERS ---')
  const orders = await prisma.order.findMany()
  console.log(`Total: ${orders.length}`)
  console.log()

  // 6. Catalog
  console.log('--- CATALOG ---')
  const catalogCategories = await prisma.catalogCategory.findMany({ include: { products: true } })
  const catalogProducts = await prisma.catalogProduct.findMany()
  console.log(`Categories: ${catalogCategories.length}`)
  console.log(`Products: ${catalogProducts.length}`)
  console.log()

  // 7. Organization Modules
  console.log('--- ORGANIZATION MODULES ---')
  const orgModules = await prisma.organizationModule.findMany()
  console.log(`Total: ${orgModules.length}`)
  console.log()

  // 8. Online Stores
  console.log('--- ONLINE STORES ---')
  const onlineStores = await prisma.onlineStore.findMany({
    include: { orders: true, categories: { include: { products: true } } }
  })
  console.log(`Total: ${onlineStores.length}`)
  onlineStores.forEach(store => {
    console.log(`  - ${store.name} (slug: ${store.slug})`)
    console.log(`    - Categories: ${store.categories.length}`)
    console.log(`    - Products: ${store.categories.reduce((acc, c) => acc + c.products.length, 0)}`)
    console.log(`    - Orders: ${store.orders.length}`)
  })
  console.log()

  // 9. Prisma Migrations
  console.log('--- PRISMA MIGRATIONS ---')
  try {
    const migrations = await prisma.$queryRaw`SELECT * FROM _prisma_migrations ORDER BY started_at DESC`
    console.log('Migrations found:')
    ;(migrations as any[]).forEach(mig => {
      console.log(`  - ${mig.migration_name} (${mig.started_at}) | Status: ${mig.applied_steps_count}/${mig.checksum ? 'OK' : 'NO'}`)
    })
  } catch (e) {
    console.log('  - Could not read _prisma_migrations table:', e)
  }
}

main()
  .catch((e) => {
    console.error('Erro na auditoria:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
