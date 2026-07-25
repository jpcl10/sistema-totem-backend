#!/usr/bin/env node

/**
 * Reconcile Payment Configuration
 * 
 * Investigates both modern (PaymentProviderCredential) and legacy (PaymentProviderSettings)
 * payment configuration sources to understand the contradiction between audits.
 * 
 * Shows:
 * - Database connection details (safely masked)
 * - Organization and context IDs
 * - Both credential sources
 * - Payment settings at all levels
 * - Runtime service behavior
 */

import { PaymentProvider } from '@prisma/client'
import { prisma } from '../src/lib/prisma.js'
import { GetMercadoPagoStatusService } from '../src/modules/payment-settings/services/get-mercado-pago-status-service.js'
import { GetCheckoutPaymentSettingsService } from '../src/modules/payments/services/get-checkout-payment-settings-service.js'

interface EnvironmentInfo {
  databaseUrl: string
  databaseHost: string
  databaseName: string
  databaseUser: string
  schema: string
  environment: string
  nodeEnv: string
}

function extractDatabaseInfo(): EnvironmentInfo {
  const url = process.env.DATABASE_URL || ''
  
  // Parse: postgresql://user:pass@host:port/database?schema=public
  const match = url.match(
    /postgresql:\/\/([^:]+):(.+)@([^:]+):(\d+)\/([^?]+)\?schema=(.+)/
  )

  if (!match) {
    return {
      databaseUrl: 'postgresql://***:***@localhost:5432/event_system?schema=public',
      databaseHost: 'localhost',
      databaseName: 'event_system',
      databaseUser: '***',
      schema: 'public',
      environment: process.env.NODE_ENV || 'development',
      nodeEnv: process.env.NODE_ENV || 'development'
    }
  }

  const [, user, , host, port, database, schema] = match

  return {
    databaseUrl: `postgresql://${user}:***@${host}:${port}/${database}?schema=${schema}`,
    databaseHost: host,
    databaseName: database,
    databaseUser: user,
    schema,
    environment: process.env.NODE_ENV || 'development',
    nodeEnv: process.env.NODE_ENV || 'development'
  }
}

async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍  PAYMENT CONFIGURATION RECONCILIATION AUDIT')
  console.log('='.repeat(80) + '\n')

  try {
    // 1. Environment Info
    const env = extractDatabaseInfo()
    console.log('📦 DATABASE ENVIRONMENT')
    console.log('-'.repeat(80))
    console.log(`  Database URL: ${env.databaseUrl}`)
    console.log(`  Host: ${env.databaseHost}`)
    console.log(`  Database: ${env.databaseName}`)
    console.log(`  Schema: ${env.schema}`)
    console.log(`  User: ${env.databaseUser}`)
    console.log(`  NODE_ENV: ${env.nodeEnv}`)
    console.log()

    // 2. Get Organization
    const organization = await prisma.organization.findFirst({
      select: {
        id: true,
        name: true,
        slug: true
      }
    })

    if (!organization) {
      console.error('❌ No organization found')
      process.exit(1)
    }

    console.log('🏢 ORGANIZATION CONTEXT')
    console.log('-'.repeat(80))
    console.log(`  Name: ${organization.name}`)
    console.log(`  Slug: ${organization.slug}`)
    console.log(`  ID: ${organization.id}`)
    console.log()

    // 3. Get Event and Store context
    const event = await prisma.event.findFirst({
      where: { organizationId: organization.id, active: true },
      select: { id: true, slug: true, name: true }
    })

    const store = await prisma.onlineStore.findFirst({
      where: { organizationId: organization.id, active: true },
      select: { id: true, slug: true, name: true }
    })

    const device = await prisma.device.findFirst({
      where: { organizationId: organization.id },
      select: { id: true, code: true }
    })

    console.log('🎯 CONTEXT IDs (for runtime testing)')
    console.log('-'.repeat(80))
    if (event) {
      console.log(`  Event ID: ${event.id} (${event.name})`)
      console.log(`  Event Slug: ${event.slug}`)
    } else {
      console.log(`  Event: ❌ None active`)
    }
    if (store) {
      console.log(`  Store ID: ${store.id} (${store.name})`)
      console.log(`  Store Slug: ${store.slug}`)
    } else {
      console.log(`  Store: ❌ None active`)
    }
    if (device) {
      console.log(`  Device ID: ${device.id}`)
      console.log(`  Device Code: ${device.code}`)
    } else {
      console.log(`  Device: ❌ None found`)
    }
    console.log()

    // 4. Modern Source: PaymentProviderCredential
    console.log('💳 MODERN SOURCE: PaymentProviderCredential')
    console.log('-'.repeat(80))

    const modernCredential = await prisma.paymentProviderCredential.findFirst({
      where: {
        organizationId: organization.id,
        provider: PaymentProvider.MERCADO_PAGO
      },
      select: {
        id: true,
        provider: true,
        environment: true,
        active: true,
        encryptedCredentials: true,
        publicMetadata: true
      }
    })

    if (modernCredential) {
      console.log(`  ✓ EXISTS`)
      console.log(`  ID: ${modernCredential.id}`)
      console.log(`  Provider: ${modernCredential.provider}`)
      console.log(`  Environment: ${modernCredential.environment}`)
      console.log(`  Active: ${modernCredential.active}`)
      console.log(`  Has Encrypted Credentials: ${!!modernCredential.encryptedCredentials}`)
      console.log(
        `  Public Metadata: ${modernCredential.publicMetadata ? JSON.stringify(modernCredential.publicMetadata) : 'none'}`
      )
    } else {
      console.log(`  ❌ NOT FOUND`)
    }
    console.log()

    // 5. Legacy Source: PaymentProviderSettings
    console.log('⚙️  LEGACY SOURCE: PaymentProviderSettings')
    console.log('-'.repeat(80))

    const legacySettings = await prisma.paymentProviderSettings.findFirst({
      where: {
        organizationId: organization.id,
        provider: PaymentProvider.MERCADO_PAGO
      },
      select: {
        id: true,
        provider: true,
        enabled: true,
        pixEnabled: true,
        cardEnabled: true,
        terminalEnabled: true,
        accessToken: true,
        publicKey: true,
        webhookSecret: true,
        webhookUrl: true
      }
    })

    if (legacySettings) {
      console.log(`  ✓ EXISTS`)
      console.log(`  ID: ${legacySettings.id}`)
      console.log(`  Provider: ${legacySettings.provider}`)
      console.log(`  Enabled: ${legacySettings.enabled}`)
      console.log(`  PIX Enabled: ${legacySettings.pixEnabled}`)
      console.log(`  Card Enabled: ${legacySettings.cardEnabled}`)
      console.log(`  Terminal Enabled: ${legacySettings.terminalEnabled}`)
      console.log(`  Has Access Token: ${!!legacySettings.accessToken}`)
      console.log(`  Has Public Key: ${!!legacySettings.publicKey}`)
      console.log(`  Has Webhook Secret: ${!!legacySettings.webhookSecret}`)
      console.log(`  Webhook URL: ${legacySettings.webhookUrl || 'not set'}`)
    } else {
      console.log(`  ❌ NOT FOUND`)
    }
    console.log()

    // 6. Organization Payment Settings
    console.log('🔐 ORGANIZATION PAYMENT SETTINGS')
    console.log('-'.repeat(80))

    const orgPaymentSettings = await prisma.organizationPaymentSettings.findUnique({
      where: { organizationId: organization.id },
      select: {
        pixEnabled: true,
        creditEnabled: true,
        debitEnabled: true,
        cashEnabled: true,
        nfcBalanceEnabled: true,
        defaultProvider: true,
        environment: true
      }
    })

    if (orgPaymentSettings) {
      console.log(`  ✓ EXISTS`)
      console.log(`  PIX Enabled: ${orgPaymentSettings.pixEnabled}`)
      console.log(`  Credit Enabled: ${orgPaymentSettings.creditEnabled}`)
      console.log(`  Debit Enabled: ${orgPaymentSettings.debitEnabled}`)
      console.log(`  Cash Enabled: ${orgPaymentSettings.cashEnabled}`)
      console.log(`  NFC Balance Enabled: ${orgPaymentSettings.nfcBalanceEnabled}`)
      console.log(`  Default Provider: ${orgPaymentSettings.defaultProvider}`)
      console.log(`  Environment: ${orgPaymentSettings.environment}`)
    } else {
      console.log(`  ❌ NOT FOUND`)
    }
    console.log()

    // 7. Context Payment Settings (Event)
    if (event) {
      console.log('🎪 CONTEXT PAYMENT SETTINGS (EVENT)')
      console.log('-'.repeat(80))

      const eventContext = await prisma.contextPaymentSettings.findFirst({
        where: {
          organizationId: organization.id,
          eventId: event.id,
          contextType: 'EVENT'
        },
        select: {
          inheritOrganizationSettings: true,
          pixEnabledOverride: true,
          creditEnabledOverride: true,
          debitEnabledOverride: true,
          cashEnabledOverride: true
        }
      })

      if (eventContext) {
        console.log(`  ✓ EXISTS`)
        console.log(`  Inherit Org Settings: ${eventContext.inheritOrganizationSettings}`)
        console.log(`  PIX Override: ${eventContext.pixEnabledOverride ?? 'none'}`)
        console.log(`  Credit Override: ${eventContext.creditEnabledOverride ?? 'none'}`)
        console.log(`  Debit Override: ${eventContext.debitEnabledOverride ?? 'none'}`)
        console.log(`  Cash Override: ${eventContext.cashEnabledOverride ?? 'none'}`)
      } else {
        console.log(`  ℹ️  No override (using org defaults)`)
      }
      console.log()
    }

    // 8. Context Payment Settings (Store)
    if (store) {
      console.log('🛒 CONTEXT PAYMENT SETTINGS (ONLINE STORE)')
      console.log('-'.repeat(80))

      const storeContext = await prisma.contextPaymentSettings.findFirst({
        where: {
          organizationId: organization.id,
          onlineStoreId: store.id,
          contextType: 'ONLINE_STORE'
        },
        select: {
          inheritOrganizationSettings: true,
          pixEnabledOverride: true,
          creditEnabledOverride: true,
          debitEnabledOverride: true,
          cashEnabledOverride: true
        }
      })

      if (storeContext) {
        console.log(`  ✓ EXISTS`)
        console.log(`  Inherit Org Settings: ${storeContext.inheritOrganizationSettings}`)
        console.log(`  PIX Override: ${storeContext.pixEnabledOverride ?? 'none'}`)
        console.log(`  Credit Override: ${storeContext.creditEnabledOverride ?? 'none'}`)
        console.log(`  Debit Override: ${storeContext.debitEnabledOverride ?? 'none'}`)
        console.log(`  Cash Override: ${storeContext.cashEnabledOverride ?? 'none'}`)
      } else {
        console.log(`  ℹ️  No override (using org defaults)`)
      }
      console.log()
    }

    // 9. Runtime: GetMercadoPagoStatusService
    console.log('⚡ RUNTIME SERVICE: GetMercadoPagoStatusService')
    console.log('-'.repeat(80))

    try {
      const mpStatusService = new GetMercadoPagoStatusService()
      const mpStatus = await mpStatusService.execute({
        organizationId: organization.id
      })

      console.log(`  configured: ${mpStatus.configured}`)
      console.log(`  pixEnabled: ${mpStatus.pixEnabled}`)
      console.log(`  environment: ${mpStatus.environment}`)
      console.log(`  accountReference: ${mpStatus.accountReference}`)
      console.log(`  webhookReady: ${mpStatus.webhookReady}`)
      console.log(`  providerActive: ${mpStatus.providerActive}`)
      console.log(`  terminalEnabled: ${mpStatus.terminalEnabled}`)
    } catch (error) {
      console.error(`  ❌ Error:`, (error as Error).message)
    }
    console.log()

    // 10. Runtime: GetCheckoutPaymentSettingsService (Event)
    if (event) {
      console.log('⚡ RUNTIME SERVICE: GetCheckoutPaymentSettingsService (Event)')
      console.log('-'.repeat(80))

      try {
        const checkoutService = new GetCheckoutPaymentSettingsService()
        const checkoutSettings = await checkoutService.execute({
          eventId: event.id,
          context: 'PUBLIC_CHECKOUT'
        })

        console.log(`  mercadoPago.enabled: ${checkoutSettings.checkoutPaymentSettings.mercadoPago.enabled}`)
        console.log(`  mercadoPago.pixAutomaticAvailable: ${checkoutSettings.checkoutPaymentSettings.mercadoPago.pixAutomaticAvailable}`)
        console.log(`  totem.pixAvailable: ${checkoutSettings.checkoutPaymentSettings.totem.pixAvailable}`)
        console.log(`  totem.cardAvailable: ${checkoutSettings.checkoutPaymentSettings.totem.cardAvailable}`)
      } catch (error) {
        console.error(`  ❌ Error:`, (error as Error).message)
      }
      console.log()
    }

    // 11. Runtime: GetCheckoutPaymentSettingsService (Store)
    if (store && event) {
      console.log('⚡ RUNTIME SERVICE: GetCheckoutPaymentSettingsService (Online Store)')
      console.log('-'.repeat(80))

      try {
        const checkoutService = new GetCheckoutPaymentSettingsService()
        const checkoutSettings = await checkoutService.execute({
          eventId: event.id,
          context: 'PUBLIC_CHECKOUT'
        })

        console.log(`  mercadoPago.enabled: ${checkoutSettings.checkoutPaymentSettings.mercadoPago.enabled}`)
        console.log(`  mercadoPago.pixAutomaticAvailable: ${checkoutSettings.checkoutPaymentSettings.mercadoPago.pixAutomaticAvailable}`)
        console.log(`  totem.pixAvailable: ${checkoutSettings.checkoutPaymentSettings.totem.pixAvailable}`)
        console.log(`  totem.cardAvailable: ${checkoutSettings.checkoutPaymentSettings.totem.cardAvailable}`)
      } catch (error) {
        console.error(`  ❌ Error:`, (error as Error).message)
      }
      console.log()
    }

    // Summary
    console.log('📊 RECONCILIATION SUMMARY')
    console.log('='.repeat(80))

    const modernExists = !!modernCredential
    const legacyExists = !!legacySettings
    const orgPixEnabled = orgPaymentSettings?.pixEnabled ?? false

    console.log(
      `  Modern (PaymentProviderCredential): ${modernExists ? '✓ FOUND' : '❌ MISSING'}`
    )
    console.log(
      `  Legacy (PaymentProviderSettings): ${legacyExists ? '✓ FOUND' : '❌ MISSING'}`
    )
    console.log(`  Org PIX Enabled: ${orgPixEnabled ? '✓ YES' : '❌ NO'}`)
    console.log()

    if (modernExists && !legacyExists) {
      console.log('  ℹ️  FINDING: Modern credential exists, legacy settings missing')
      console.log('      → System may use modern source exclusively')
      console.log('      → Previous audit may have checked legacy settings')
    } else if (!modernExists && legacyExists) {
      console.log('  ℹ️  FINDING: Legacy settings exist, modern credential missing')
      console.log('      → System may use legacy source exclusively')
    } else if (modernExists && legacyExists) {
      console.log('  ⚠️  FINDING: Both sources exist (potential duplication)')
      console.log('      → Need to verify which one runtime actually uses')
    } else {
      console.log('  ❌ FINDING: Neither source configured!')
      console.log('      → No payment provider configured at all')
    }

    console.log('\n' + '='.repeat(80) + '\n')
  } catch (error) {
    console.error('❌ Reconciliation failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
