
import { prisma } from './src/lib/prisma.js'

async function main() {
  console.log('🔍 Querying ALL events with their EventProducts...')
  const allEvents = await prisma.event.findMany({
    include: {
      eventProducts: {
        include: {
          catalogProduct: {
            include: { catalogCategory: true }
          }
        }
      }
    }
  })

  if (allEvents.length === 0) {
    console.log('❌ No events found!')
    return
  }

  console.log(`✅ Found ${allEvents.length} events!`)

  for (const event of allEvents) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📅 Event: ${event.name} (slug: "${event.slug}")`)
    console.log(`   - ID: ${event.id}`)
    console.log(`   - Active: ${event.active}`)
    console.log(`   - EventProducts count: ${event.eventProducts.length}`)

    if (event.eventProducts.length > 0) {
      console.log('\n   📦 EventProducts:')
      for (const ep of event.eventProducts) {
        console.log('\n   • EventProduct ID:', ep.id)
        console.log('     - Active:', ep.active)
        console.log('     - Sold Out:', ep.soldOut)
        console.log('     - Track Stock:', ep.trackStock)
        console.log('     - Stock Quantity:', ep.stockQuantity)
        console.log('     - Catalog Product:', ep.catalogProduct.name, '(ID:', ep.catalogProduct.id, ', Active:', ep.catalogProduct.active, ')')
        console.log('     - Category:', ep.catalogProduct.catalogCategory?.name, '(ID:', ep.catalogProduct.catalogCategory?.id, ', Active:', ep.catalogProduct.catalogCategory?.active, ')')
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
