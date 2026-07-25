import { prisma } from '../src/lib/prisma.js'

/**
 * Diagnostic script to identify PIX payment flow issues
 * Run with: npx tsx scripts/diagnose-pix-payment-flow.ts
 */

async function main() {
  console.log('\n🔍 PIX Payment Flow Diagnostic\n')

  try {
    // Find active organization
    const organization = await prisma.organization.findFirst({
      select: {
        id: true,
        slug: true,
        name: true,
      },
    })

    if (!organization) {
      console.error('❌ No active organization found')
      return
    }

    console.log(`📦 Organization: ${organization.name} (${organization.slug})`)

    // Check Mercado Pago settings
    const mpSettings = await prisma.paymentProviderSettings.findUnique({
      where: {
        organizationId_provider: {
          organizationId: organization.id,
          provider: 'MERCADO_PAGO',
        },
      },
      select: {
        enabled: true,
        pixEnabled: true,
        cardEnabled: true,
        terminalEnabled: true,
        accessToken: true,
        publicKey: true,
        webhookSecret: true,
        webhookUrl: true,
      },
    })

    console.log('\n💳 Mercado Pago Settings:')
    if (!mpSettings) {
      console.log('   ❌ No MP settings found')
    } else {
      console.log(`   ✓ Enabled: ${mpSettings.enabled}`)
      console.log(`   ✓ PIX Enabled: ${mpSettings.pixEnabled}`)
      console.log(`   ✓ Card Enabled: ${mpSettings.cardEnabled}`)
      console.log(`   ✓ Terminal Enabled: ${mpSettings.terminalEnabled}`)
      console.log(`   ✓ Access Token: ${mpSettings.accessToken ? '✓ SET' : '❌ MISSING'}`)
      console.log(`   ✓ Public Key: ${mpSettings.publicKey ? '✓ SET' : '❌ MISSING'}`)
      console.log(`   ✓ Webhook Secret: ${mpSettings.webhookSecret ? '✓ SET' : '❌ MISSING'}`)
      console.log(`   ✓ Webhook URL: ${mpSettings.webhookUrl ? '✓ SET' : '❌ MISSING'}`)
    }

    // Check org payment settings
    const orgPaymentSettings = await prisma.organizationPaymentSettings.findUnique({
      where: { organizationId: organization.id },
      select: {
        pixEnabled: true,
        creditEnabled: true,
        debitEnabled: true,
        cashEnabled: true,
        nfcBalanceEnabled: true,
      },
    })

    console.log('\n🔐 Organization Payment Settings:')
    if (!orgPaymentSettings) {
      console.log('   ❌ No org payment settings found')
    } else {
      console.log(`   ✓ PIX Enabled: ${orgPaymentSettings.pixEnabled}`)
      console.log(`   ✓ Credit Enabled: ${orgPaymentSettings.creditEnabled}`)
      console.log(`   ✓ Debit Enabled: ${orgPaymentSettings.debitEnabled}`)
      console.log(`   ✓ Cash Enabled: ${orgPaymentSettings.cashEnabled}`)
      console.log(`   ✓ NFC Balance Enabled: ${orgPaymentSettings.nfcBalanceEnabled}`)
    }

    // Find a Totem event
    const event = await prisma.event.findFirst({
      where: {
        organizationId: organization.id,
        active: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        pixEnabled: true,
        pixKey: true,
      },
    })

    if (event) {
      console.log(`\n📅 Sample Totem Event: ${event.name} (${event.slug})`)
      console.log(`   ✓ PIX Manual Enabled: ${event.pixEnabled}`)
      console.log(`   ✓ PIX Key: ${event.pixKey ? '✓ SET' : '❌ MISSING'}`)

      // Check event context payment settings
      const contextPaymentSettings = await prisma.contextPaymentSettings.findFirst({
        where: {
          organizationId: organization.id,
          eventId: event.id,
          contextType: 'EVENT',
        },
        select: {
          pixEnabledOverride: true,
          creditEnabledOverride: true,
          debitEnabledOverride: true,
          inheritOrganizationSettings: true,
        },
      })

      if (contextPaymentSettings) {
        console.log('\n   Event Payment Settings Override:')
        console.log(`   ✓ Inherit Org Settings: ${contextPaymentSettings.inheritOrganizationSettings}`)
        console.log(`   ✓ PIX Override: ${contextPaymentSettings.pixEnabledOverride ?? 'none'}`)
        console.log(`   ✓ Credit Override: ${contextPaymentSettings.creditEnabledOverride ?? 'none'}`)
        console.log(`   ✓ Debit Override: ${contextPaymentSettings.debitEnabledOverride ?? 'none'}`)
      } else {
        console.log('   ℹ️  No event context settings override (using org defaults)')
      }
    } else {
      console.log('\n   ℹ️  No active Totem events found in organization')
    }

    // Find a digital menu store
    const store = await prisma.onlineStore.findFirst({
      where: {
        organizationId: organization.id,
        active: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    })

    if (store) {
      console.log(`\n🛒 Sample Digital Menu Store: ${store.name} (${store.slug})`)

      // Check store context payment settings
      const storeContextSettings = await prisma.contextPaymentSettings.findFirst({
        where: {
          organizationId: organization.id,
          onlineStoreId: store.id,
          contextType: 'ONLINE_STORE',
        },
        select: {
          pixEnabledOverride: true,
          creditEnabledOverride: true,
          debitEnabledOverride: true,
          inheritOrganizationSettings: true,
        },
      })

      if (storeContextSettings) {
        console.log('   Store Payment Settings Override:')
        console.log(`   ✓ Inherit Org Settings: ${storeContextSettings.inheritOrganizationSettings}`)
        console.log(`   ✓ PIX Override: ${storeContextSettings.pixEnabledOverride ?? 'none'}`)
        console.log(`   ✓ Credit Override: ${storeContextSettings.creditEnabledOverride ?? 'none'}`)
        console.log(`   ✓ Debit Override: ${storeContextSettings.debitEnabledOverride ?? 'none'}`)
      } else {
        console.log('   ℹ️  No store context settings override (using org defaults)')
      }
    } else {
      console.log('\n   ℹ️  No active digital menu stores found in organization')
    }

    console.log('\n✅ Diagnosis complete\n')
  } catch (error) {
    console.error('❌ Error during diagnosis:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
