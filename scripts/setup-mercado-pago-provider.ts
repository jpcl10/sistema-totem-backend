#!/usr/bin/env node

import { PaymentProvider, PaymentEnvironment } from '@prisma/client'
import { prisma } from '../src/lib/prisma.js'

const args = process.argv.slice(2)

async function main() {
  console.log('\n🚀 Mercado Pago Payment Provider Setup\n')

  // Get organization
  const organization = await prisma.organization.findFirst({
    select: { id: true, name: true, slug: true }
  })

  if (!organization) {
    console.error('❌ No organization found in database')
    process.exit(1)
  }

  console.log(`📦 Organization: ${organization.name} (${organization.slug})`)

  // Get credentials from command line arguments or environment
  const accessToken = args[0] || process.env.MERCADO_PAGO_ACCESS_TOKEN
  const publicKey = args[1] || process.env.MERCADO_PAGO_PUBLIC_KEY
  const webhookSecret = args[2] || process.env.MERCADO_PAGO_WEBHOOK_SECRET
  const webhookUrl = args[3] || process.env.MERCADO_PAGO_WEBHOOK_URL

  // Validate credentials
  if (
    !accessToken ||
    accessToken === 'seu-access-token' ||
    !publicKey ||
    publicKey === 'sua-public-key'
  ) {
    console.error('\n❌ Invalid or missing Mercado Pago credentials')
    console.error(
      '\n📋 Usage: npx tsx scripts/setup-mercado-pago-provider.ts <ACCESS_TOKEN> <PUBLIC_KEY> [WEBHOOK_SECRET] [WEBHOOK_URL]\n'
    )
    console.error('📌 Or set environment variables:')
    console.error('   - MERCADO_PAGO_ACCESS_TOKEN')
    console.error('   - MERCADO_PAGO_PUBLIC_KEY')
    console.error('   - MERCADO_PAGO_WEBHOOK_SECRET (optional)')
    console.error('   - MERCADO_PAGO_WEBHOOK_URL (optional)\n')
    console.error(
      '🔗 Get credentials from: https://www.mercadopago.com.br/developers/pt-BR/docs\n'
    )
    process.exit(1)
  }

  try {
    // Create or update Mercado Pago payment provider settings
    const setting = await prisma.paymentProviderSettings.upsert({
      where: {
        organizationId_provider: {
          organizationId: organization.id,
          provider: PaymentProvider.MERCADO_PAGO
        }
      },
      create: {
        organizationId: organization.id,
        provider: PaymentProvider.MERCADO_PAGO,
        enabled: true,
        pixEnabled: true,
        cardEnabled: true,
        terminalEnabled: false,
        accessToken,
        publicKey,
        webhookSecret: webhookSecret || null,
        webhookUrl: webhookUrl || null
      },
      update: {
        enabled: true,
        pixEnabled: true,
        cardEnabled: true,
        terminalEnabled: false,
        accessToken,
        publicKey,
        webhookSecret: webhookSecret || null,
        webhookUrl: webhookUrl || null
      }
    })

    console.log('\n✅ Mercado Pago Provider Settings Configured Successfully!\n')
    console.log('💳 Configuration:')
    console.log(`   ✓ Provider: MERCADO_PAGO`)
    console.log(`   ✓ Enabled: ${setting.enabled}`)
    console.log(`   ✓ PIX Enabled: ${setting.pixEnabled}`)
    console.log(`   ✓ Card Enabled: ${setting.cardEnabled}`)
    console.log(`   ✓ Terminal Enabled: ${setting.terminalEnabled}`)
    console.log(`   ✓ Access Token: ${accessToken.substring(0, 10)}...`)
    console.log(`   ✓ Public Key: ${publicKey.substring(0, 10)}...`)
    console.log(
      `   ✓ Webhook URL: ${webhookUrl ? webhookUrl : 'Not configured'}\n`
    )

    // Verify settings were saved
    const orgPaymentSettings = await prisma.organizationPaymentSettings.findUnique(
      {
        where: { organizationId: organization.id },
        select: {
          pixEnabled: true,
          creditEnabled: true,
          debitEnabled: true
        }
      }
    )

    console.log('🔐 Organization Payment Settings:')
    console.log(`   ✓ PIX Enabled: ${orgPaymentSettings?.pixEnabled ?? false}`)
    console.log(
      `   ✓ Credit Enabled: ${orgPaymentSettings?.creditEnabled ?? false}`
    )
    console.log(`   ✓ Debit Enabled: ${orgPaymentSettings?.debitEnabled ?? false}\n`)

    console.log('📌 Next Steps:')
    console.log('   1. Make sure PIX is enabled at organization level')
    console.log('   2. Configure PIX key if using manual PIX mode')
    console.log('   3. Test the payment flow from the Totem interface')
    console.log('   4. Verify webhook configuration for payment status updates\n')
  } catch (error) {
    console.error('❌ Error configuring Mercado Pago:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
